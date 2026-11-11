/**
 * Offline SDK replay of recorded mainnet fixtures through a real kit RPC with
 * a mocked transport (no network). Covers lookup-table resolution, truthful
 * fee + reconciliation diagnostics, JSON survival, and visible
 * unsupported-version failures.
 */
import { describe, test, expect } from "bun:test";
import { createIndexer } from "./client";
import type { SkippedTransaction } from "./client";
import { toJsonClassifiedTransaction } from "./json-types";
import { TxIndexerError, UnsupportedTransactionVersionError } from "./errors";
import {
  createFixtureRpc,
  loadFixture,
} from "@tx-indexer/solana/__fixtures__/fixture-rpc";

const swap = loadFixture("jupiter-swap-sol-to-token.json");
const sell = loadFixture("jupiter-swap-token-to-sol.json");
const v2 = loadFixture("unsupported-version-synthetic-v2-error.json");

function indexerFor(historySignatures?: string[]) {
  const { rpc } = createFixtureRpc(
    {
      [swap.meta.signature]: swap.responseText,
      [sell.meta.signature]: sell.responseText,
      [v2.meta.signature]: v2.responseText,
    },
    { historySignatures },
  );
  return createIndexer({ client: { rpc: rpc as never } });
}

describe("SDK replay of recorded v0 Jupiter swap", () => {
  test("getTransaction: resolved keys, meta.fee fee leg, balanced reconciliation, swap", async () => {
    const indexer = indexerFor();
    const result = await indexer.getTransaction(swap.meta.signature, {
      enrichNftMetadata: false,
      enrichTokenMetadata: false,
    });
    expect(result).not.toBeNull();
    const { tx, legs, classification } = result!;

    expect(tx.accountKeys).toHaveLength(17);
    expect(tx.accountKeys![0]).toBe("EMgSdxvQqmaqjynWyNeEXcgpMDERxD7ntvBcUWr3PaEb");
    expect(tx.loadedAddresses?.writable).toHaveLength(3);
    expect(tx.reconciliation).toEqual({
      status: "balanced",
      feeLamports: "5039",
      netLamportsOut: "5039",
      residualLamports: "0",
      accountCount: 17,
    });
    expect(legs.find((l) => l.role === "fee")?.amount.amountRaw).toBe("5039");
    // The lookup-table wSOL vault appears once: its lamport delta, attributed
    // to the vault's owner (tagged protocol: because the swap is on Jupiter).
    expect(legs.some((l) => l.accountId.endsWith("C47dRtozmsagyUSwaejLiBSPemvHK7J7U7UH8jibviqp"))).toBe(false);
    expect(
      legs.filter(
        (l) => l.side === "credit" && l.amount.amountRaw === "4142844",
      ).map((l) => l.accountId),
    ).toEqual(["protocol:jupiter:SOL:HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC"]);
    expect(classification.primaryType).toBe("swap");

    const json = JSON.parse(JSON.stringify(toJsonClassifiedTransaction(result!)));
    expect(json.tx.reconciliation.status).toBe("balanced");
    expect(json.tx.reconciliation.residualLamports).toBe("0");
    expect(json.tx.loadedAddresses.writable).toEqual(tx.loadedAddresses!.writable);
    expect(json.tx.preBalances[10]).toBe("135692492640");
  });

  test("getTransaction on a transaction above version 1 (synthetic v2) throws UnsupportedTransactionVersionError", async () => {
    const indexer = indexerFor();
    const error = await indexer
      .getTransaction(v2.meta.signature, { enrichNftMetadata: false })
      .catch((e) => e);
    expect(error).toBeInstanceOf(UnsupportedTransactionVersionError);
    expect(error).toBeInstanceOf(TxIndexerError);
    expect(error.signature).toBe(v2.meta.signature);
    expect(error.code).toBe("UNSUPPORTED_TRANSACTION_VERSION");
    expect(error.retryable).toBe(false);
  });

  test("getTransactions reports the skipped unsupported-version (synthetic v2) signature instead of dropping it silently", async () => {
    const indexer = indexerFor([swap.meta.signature, v2.meta.signature, sell.meta.signature]);
    const skipped: SkippedTransaction[] = [];
    const txs = await indexer.getTransactions(
      "EMgSdxvQqmaqjynWyNeEXcgpMDERxD7ntvBcUWr3PaEb",
      {
        limit: 10,
        filterSpam: false,
        enrichNftMetadata: false,
        enrichTokenMetadata: false,
        maxIterations: 1,
        retry: { maxAttempts: 1 },
        onTransactionSkipped: (s) => skipped.push(s),
      },
    );

    expect(txs.map((t) => String(t.tx.signature)).sort()).toEqual(
      [swap.meta.signature, sell.meta.signature].sort(),
    );
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.signature).toBe(v2.meta.signature);
    expect(skipped[0]!.reason).toBe("unsupported_version");
    expect(skipped[0]!.error).toBeInstanceOf(UnsupportedTransactionVersionError);
  });

  test("getTransactionsBySignatures reports not_found and unsupported_version", async () => {
    const indexer = indexerFor();
    const skipped: SkippedTransaction[] = [];
    const missing = "1111111111111111111111111111111111111111111111111111111111111111";
    const txs = await indexer.getTransactionsBySignatures(
      [swap.meta.signature, v2.meta.signature, missing],
      "EMgSdxvQqmaqjynWyNeEXcgpMDERxD7ntvBcUWr3PaEb",
      {
        filterSpam: false,
        enrichNftMetadata: false,
        enrichTokenMetadata: false,
        retry: { maxAttempts: 1 },
        onTransactionSkipped: (s) => skipped.push(s),
      },
    );
    expect(txs).toHaveLength(1);
    const reasons = Object.fromEntries(skipped.map((s) => [s.signature, s.reason]));
    expect(reasons).toEqual({
      [v2.meta.signature]: "unsupported_version",
      [missing]: "not_found",
    });
  });
});

describe("tx-indexer/advanced fetchers surface the public error type", () => {
  test("fetchTransaction throws the public UnsupportedTransactionVersionError on a -32015 (synthetic v2)", async () => {
    const { fetchTransaction } = await import("./advanced");
    const { isTxIndexerError } = await import("./errors");
    const { rpc } = createFixtureRpc({ [v2.meta.signature]: v2.responseText });
    const error = await fetchTransaction(rpc as never, v2.meta.signature as never, {
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
    }).catch((e) => e);
    expect(error).toBeInstanceOf(UnsupportedTransactionVersionError);
    expect(isTxIndexerError(error)).toBe(true);
    expect(error.signature).toBe(v2.meta.signature);
    expect(error.transactionVersion).toBe(2);
    expect(error.maxSupportedTransactionVersion).toBe(1);
  });

  test("fetchTransactionsBatch delivers the public error in onSkipped and onFetchError", async () => {
    const { fetchTransactionsBatch } = await import("./advanced");
    const { rpc } = createFixtureRpc({
      [v2.meta.signature]: v2.responseText,
      [swap.meta.signature]: swap.responseText,
    });
    const skippedErrors: unknown[] = [];
    const fetchErrors: unknown[] = [];
    const txs = await fetchTransactionsBatch(
      rpc as never,
      [swap.meta.signature, v2.meta.signature] as never,
      {
        retry: { maxAttempts: 1 },
        onSkipped: (s) => skippedErrors.push(s.error),
        onFetchError: (_sig, e) => fetchErrors.push(e),
      },
    );
    expect(txs).toHaveLength(1);
    expect(skippedErrors).toHaveLength(1);
    expect(skippedErrors[0]).toBeInstanceOf(UnsupportedTransactionVersionError);
    expect(fetchErrors[0]).toBeInstanceOf(UnsupportedTransactionVersionError);
  });
});

describe("SDK replay of recorded v1 transactions", () => {
  async function classify(name: string) {
    const f = loadFixture(name);
    const { rpc } = createFixtureRpc({ [f.meta.signature]: f.responseText });
    const indexer = createIndexer({ client: { rpc: rpc as never } });
    const result = await indexer.getTransaction(f.meta.signature, {
      enrichNftMetadata: false,
      enrichTokenMetadata: false,
    });
    expect(result).not.toBeNull();
    return result!;
  }

  test("Jupiter token -> token swap (v1): classified as the fee payer's swap", async () => {
    const { tx, legs, classification } = await classify("v1-jupiter-swap-token-to-token.json");
    expect(tx.accountKeys).toHaveLength(49);
    expect(tx.reconciliation?.status).toBe("balanced");
    expect(legs.find((l) => l.role === "fee")?.amount.amountRaw).toBe("14200");
    expect(tx.protocol?.id).toBe("jupiter");
    // Fee payer Fni6... sends 100,000 DKYc... (raw 100000000000, 6 dp) and
    // receives 119,883.098235 8Xg8... (raw 119883098235, 6 dp).
    expect(classification.primaryType).toBe("swap");
    expect(classification.primaryAmount?.token.mint).toBe("DKYcjobF7HPtL9RyQBRdeRQ2iWvizpfbgWwPWNXdpump");
    expect(classification.primaryAmount?.amountRaw).toBe("100000000000");
    expect(classification.secondaryAmount?.token.mint).toBe("8Xg89xT8Ve34sKiYqYuMs46mycREsCA2F362UscRpump");
    expect(classification.secondaryAmount?.amountRaw).toBe("119883098235");

    const json = JSON.parse(JSON.stringify(toJsonClassifiedTransaction({ tx, legs, classification })));
    expect(json.tx.reconciliation.status).toBe("balanced");
  });

  test("SOL -> token buy (v1): keys, fee and reconciliation hold", async () => {
    const { tx, legs } = await classify("v1-swap-sol-to-token.json");
    expect(tx.accountKeys).toHaveLength(38);
    expect(tx.reconciliation?.status).toBe("balanced");
    expect(legs.find((l) => l.role === "fee")?.amount.amountRaw).toBe("12971");
  });

  // Known classifier gap, not specific to v1: the transaction calls the Memo
  // program and carries a memo, and isSolanaPayTransaction treats ANY Memo
  // program call with a non-null memo as Solana Pay. SolanaPayClassifier
  // (priority 95) therefore claims it and returns "transfer" (pool HscovBe9...
  // -> buyer), so SwapClassifier (priority 80) never runs. What it really is:
  // Dha7... pays about 0.309 SOL and receives 7,074,185.417628 H3xK... (see the
  // fixture README). Flip to `test` when the classifier handles it.
  test.failing("SOL -> token buy (v1): classified as a swap (known gap, currently 'transfer')", async () => {
    const { classification } = await classify("v1-swap-sol-to-token.json");
    expect(classification.primaryType).toBe("swap");
  });

  test("Jupiter circular route (v1): keys, fee and reconciliation hold; classified as a swap", async () => {
    const { tx, legs, classification } = await classify("v1-jupiter-route-usdc-gain.json");
    expect(tx.accountKeys).toHaveLength(35);
    expect(tx.reconciliation?.status).toBe("balanced");
    expect(legs.find((l) => l.role === "fee")?.amount.amountRaw).toBe("7559");
    expect(classification.primaryType).toBe("swap");
    expect(classification.secondaryAmount?.token.symbol).toBe("USDC");
    expect(classification.secondaryAmount?.amountRaw).toBe("1857");
  });

  // Known classifier gap, not specific to v1: the signer puts nothing into
  // the route (USDC -> cbBTC -> WBTC -> USDC across pools). Its only SOL debit
  // is the whole 7,559-lamport network fee; because the protocol is a known
  // DEX (Jupiter), the tiny-SOL guard does not apply and SwapClassifier picks
  // that full SOL debit as the swap's consideration (primaryAmount).
  test.failing("Jupiter circular route (v1): the network fee is not reported as the swap input (known gap)", async () => {
    const { classification } = await classify("v1-jupiter-route-usdc-gain.json");
    expect(classification.primaryAmount?.amountRaw).not.toBe("7559");
  });
});

describe("closed token account provenance survives JSON (completeLegs)", () => {
  test("closedTokenAccount is on the closed account's complete debit leg only, after JSON round-trip; legs carry none", async () => {
    const { SOL, TOKEN_PROGRAM, mockRpc, syntheticResponse } = await import(
      "@tx-indexer/solana/__fixtures__/synthetic"
    );
    const ALICE = "A1ice11111111111111111111111111111111111111";
    const BOB = "Bob1111111111111111111111111111111111111111";
    const ALICE_ATA = "A1iceATA111111111111111111111111111111111111";
    const BOB_ATA = "BobATA11111111111111111111111111111111111111";
    const MINT = "MintA11111111111111111111111111111111111111";
    const RENT = 2039280n;
    const { rpc } = mockRpc(() =>
      syntheticResponse({
        staticKeys: [ALICE, ALICE_ATA, BOB_ATA, TOKEN_PROGRAM],
        pre: [SOL, RENT, RENT, 1n],
        post: [SOL + RENT - 5000n, 0n, RENT, 1n],
        instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
        preTokenBalances: [
          { accountIndex: 1, mint: MINT, owner: ALICE, amount: 750_000n, decimals: 6 },
          { accountIndex: 2, mint: MINT, owner: BOB, amount: 0n, decimals: 6 },
        ],
        postTokenBalances: [{ accountIndex: 2, mint: MINT, owner: BOB, amount: 750_000n, decimals: 6 }],
      }),
    );
    const indexer = createIndexer({ client: { rpc: rpc as never } });
    const result = await indexer.getTransaction(
      "Sweep1111111111111111111111111111111111111111111111111111111111111111111111111111111111" as never,
      { walletAddress: ALICE as never, enrichNftMetadata: false, enrichTokenMetadata: false },
    );
    const json = JSON.parse(JSON.stringify(toJsonClassifiedTransaction(result!)));
    expect(json.legs.some((l: { closedTokenAccount?: string }) => "closedTokenAccount" in l)).toBe(false);
    const flagged = json.completeLegs.filter((l: { closedTokenAccount?: string }) => "closedTokenAccount" in l);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].closedTokenAccount).toBe(ALICE_ATA);
    expect(flagged[0].side).toBe("debit");
    expect(flagged[0].amount.amountRaw).toBe("750000");
  });
});

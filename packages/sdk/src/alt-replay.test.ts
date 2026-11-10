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
const v1 = loadFixture("unsupported-version-v1-error.json");

function indexerFor(historySignatures?: string[]) {
  const { rpc } = createFixtureRpc(
    {
      [swap.meta.signature]: swap.responseText,
      [sell.meta.signature]: sell.responseText,
      [v1.meta.signature]: v1.responseText,
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
    // The lookup-table wSOL vault's lamport credit is the backing of its wSOL
    // token balance: it appears once, as the token leg of the vault's owner.
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

  test("getTransaction on a v1 transaction throws UnsupportedTransactionVersionError", async () => {
    const indexer = indexerFor();
    const error = await indexer
      .getTransaction(v1.meta.signature, { enrichNftMetadata: false })
      .catch((e) => e);
    expect(error).toBeInstanceOf(UnsupportedTransactionVersionError);
    expect(error).toBeInstanceOf(TxIndexerError);
    expect(error.signature).toBe(v1.meta.signature);
    expect(error.code).toBe("UNSUPPORTED_TRANSACTION_VERSION");
    expect(error.retryable).toBe(false);
  });

  test("getTransactions reports the skipped v1 signature instead of dropping it silently", async () => {
    const indexer = indexerFor([swap.meta.signature, v1.meta.signature, sell.meta.signature]);
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
    expect(skipped[0]!.signature).toBe(v1.meta.signature);
    expect(skipped[0]!.reason).toBe("unsupported_version");
    expect(skipped[0]!.error).toBeInstanceOf(UnsupportedTransactionVersionError);
  });

  test("getTransactionsBySignatures reports not_found and unsupported_version", async () => {
    const indexer = indexerFor();
    const skipped: SkippedTransaction[] = [];
    const missing = "1111111111111111111111111111111111111111111111111111111111111111";
    const txs = await indexer.getTransactionsBySignatures(
      [swap.meta.signature, v1.meta.signature, missing],
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
      [v1.meta.signature]: "unsupported_version",
      [missing]: "not_found",
    });
  });
});

describe("tx-indexer/advanced fetchers surface the public error type", () => {
  test("fetchTransaction throws the public UnsupportedTransactionVersionError on the recorded -32015", async () => {
    const { fetchTransaction } = await import("./advanced");
    const { isTxIndexerError } = await import("./errors");
    const { rpc } = createFixtureRpc({ [v1.meta.signature]: v1.responseText });
    const error = await fetchTransaction(rpc as never, v1.meta.signature as never, {
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
    }).catch((e) => e);
    expect(error).toBeInstanceOf(UnsupportedTransactionVersionError);
    expect(isTxIndexerError(error)).toBe(true);
    expect(error.signature).toBe(v1.meta.signature);
    expect(error.transactionVersion).toBe(1);
  });

  test("fetchTransactionsBatch delivers the public error in onSkipped and onFetchError", async () => {
    const { fetchTransactionsBatch } = await import("./advanced");
    const { rpc } = createFixtureRpc({
      [v1.meta.signature]: v1.responseText,
      [swap.meta.signature]: swap.responseText,
    });
    const skippedErrors: unknown[] = [];
    const fetchErrors: unknown[] = [];
    const txs = await fetchTransactionsBatch(
      rpc as never,
      [swap.meta.signature, v1.meta.signature] as never,
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

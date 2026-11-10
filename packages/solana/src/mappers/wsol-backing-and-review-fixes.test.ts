import { describe, test, expect } from "bun:test";
import type { Signature } from "@solana/kit";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { fetchTransaction, fetchTransactionsBatch } from "../fetcher/transactions";
import { transactionToLegs } from "./transaction-to-legs";
import type { SkippedTransaction } from "../rpc/errors";
import {
  SOL,
  mockRpc,
  syntheticResponse,
  WSOL_MINT,
  TOKEN_PROGRAM,
} from "../__fixtures__/synthetic";

const SIG = "WsolSignature1111111111111111111111111111111111111111111111111111111111111111111111111" as Signature;
const ALICE = "A1ice11111111111111111111111111111111111111";
const BOB = "Bob1111111111111111111111111111111111111111";
const ALICE_ATA = "A1iceATA111111111111111111111111111111111111";
const BOB_ATA = "BobATA11111111111111111111111111111111111111";
const RENT = 2039280n;

const fmt = (legs: TxLeg[]) =>
  legs.map((l) => `${l.accountId} ${l.side} ${l.amount.amountRaw} ${l.role}`).sort();

function expectNoRentLegs(legs: TxLeg[]) {
  expect(legs.filter((l) => l.accountId.startsWith("rent:"))).toEqual([]);
}

async function legsFor(input: Parameters<typeof syntheticResponse>[0]) {
  const { rpc } = mockRpc(() => syntheticResponse(input));
  const tx = (await fetchTransaction(rpc, SIG))!;
  return { tx, legs: transactionToLegs(tx) };
}

describe("wSOL accounts are represented once: lamport delta, owner-attributed", () => {
  test("existing -> existing: owner-attributed lamport legs, no separate token or account legs", async () => {
    const { tx, legs } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA, BOB_ATA], readonly: [] },
      pre: [SOL, 1n, RENT + 2n * SOL, RENT],
      post: [SOL - 5000n, 1n, RENT + SOL, RENT + SOL],
      preTokenBalances: [
        { accountIndex: 2, mint: WSOL_MINT, owner: ALICE, amount: 2n * SOL },
        { accountIndex: 3, mint: WSOL_MINT, owner: BOB, amount: 0n },
      ],
      postTokenBalances: [
        { accountIndex: 2, mint: WSOL_MINT, owner: ALICE, amount: SOL },
        { accountIndex: 3, mint: WSOL_MINT, owner: BOB, amount: SOL },
      ],
    });
    expect(fmt(legs)).toEqual(
      [
        `external:${ALICE} debit 5000 sent`,
        `external:${ALICE} debit 1000000000 sent`,
        `external:${BOB} credit 1000000000 received`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );
    expect(legs.some((l) => l.accountId.includes("ATA"))).toBe(false);
    // Reconciliation works from raw balances and is untouched.
    expect(tx.reconciliation?.status).toBe("balanced");
  });

  test("created in the transaction: the owner is credited the full lamport delta (reserve included)", async () => {
    const { legs } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [BOB_ATA], readonly: [] },
      pre: [5n * SOL, 1n, 0n],
      post: [5n * SOL - SOL - RENT - 5000n, 1n, SOL + RENT],
      postTokenBalances: [
        { accountIndex: 2, mint: WSOL_MINT, owner: BOB, amount: SOL },
      ],
    });
    expect(fmt(legs)).toEqual(
      [
        `external:${ALICE} debit ${SOL + RENT + 5000n} sent`,
        `external:${BOB} credit ${SOL + RENT} received`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );
    expectNoRentLegs(legs);
  });

  test("pre-only wSOL entry (account closed): lamport leg unchanged, as on main", async () => {
    const { legs } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA], readonly: [] },
      pre: [SOL, 1n, SOL + RENT],
      post: [2n * SOL + RENT - 5000n, 1n, 0n],
      preTokenBalances: [
        { accountIndex: 2, mint: WSOL_MINT, owner: ALICE, amount: SOL },
      ],
    });
    expect(fmt(legs)).toEqual(
      [
        `external:${ALICE} credit ${SOL + RENT - 5000n} received`,
        `external:${ALICE_ATA} debit ${SOL + RENT} sent`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );
  });

  test("non-native token accounts keep ordinary lamport legs (rent of a new USDC ATA)", async () => {
    const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const { legs } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [BOB_ATA], readonly: [] },
      pre: [SOL, 1n, 0n],
      post: [SOL - RENT - 5000n, 1n, RENT],
      postTokenBalances: [
        { accountIndex: 2, mint: USDC, owner: BOB, amount: 5_000_000n, decimals: 6 },
      ],
    });
    expect(fmt(legs)).toContain(`external:${BOB_ATA} credit ${RENT} received`);
  });
});

describe("created wSOL accounts: the full lamport delta goes to the owner, no rent label", () => {
  test("create then fund WITHOUT sync_native: the owner is credited the full delta", async () => {
    const { legs } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [BOB_ATA], readonly: [] },
      pre: [5n * SOL, 1n, 0n],
      post: [5n * SOL - SOL - RENT - 5000n, 1n, SOL + RENT],
      postTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: BOB, amount: 0n }],
    });
    expect(fmt(legs)).toEqual(
      [
        `external:${ALICE} debit ${SOL + RENT + 5000n} sent`,
        `external:${BOB} credit ${SOL + RENT} received`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );
    expectNoRentLegs(legs);
  });

  test("created, funded 1 SOL, 0.4 SOL spent: the owner is credited reserve + 0.6 SOL", async () => {
    const CAROL = "Caro11111111111111111111111111111111111111";
    const { legs } = await legsFor({
      staticKeys: [ALICE, CAROL, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA], readonly: [] },
      pre: [5n * SOL, 0n, 1n, 0n],
      post: [4n * SOL - RENT - 5000n, 400_000_000n, 1n, RENT + 600_000_000n],
      postTokenBalances: [{ accountIndex: 3, mint: WSOL_MINT, owner: ALICE, amount: 600_000_000n }],
    });
    expect(fmt(legs)).toContain(`external:${ALICE} credit ${RENT + 600_000_000n} received`);
    expect(fmt(legs)).toContain(`external:${CAROL} credit 400000000 received`);
    expectNoRentLegs(legs);
  });

  test("created with only a few lamports: whole delta to the owner", async () => {
    const { legs } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [BOB_ATA], readonly: [] },
      pre: [SOL, 1n, 0n],
      post: [SOL - 1_000_000n - 5000n, 1n, 1_000_000n],
      postTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: BOB, amount: 0n }],
    });
    expect(fmt(legs)).toEqual(
      [
        `external:${ALICE} debit 1005000 sent`,
        `external:${BOB} credit 1000000 received`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );
    expect(legs.every((l) => BigInt(l.amount.amountRaw) > 0n)).toBe(true);
    expectNoRentLegs(legs);
  });

  // Reduced rent (6,333 lamports/byte): reserve of a 165-byte token account is
  // (165 + 128) * 6,333 = 1,855,569 lamports, not 2,039,280.
  const REDUCED_RESERVE = (165n + 128n) * 6_333n;

  test("reduced rent, synced with 183,711 lamports (post 2,039,280): full delta to the owner", async () => {
    expect(REDUCED_RESERVE).toBe(1_855_569n);
    const post = REDUCED_RESERVE + 183_711n;
    expect(post).toBe(2_039_280n);
    const { legs } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [BOB_ATA], readonly: [] },
      pre: [SOL, 1n, 0n],
      post: [SOL - post - 5000n, 1n, post],
      postTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: BOB, amount: 183_711n }],
    });
    expect(fmt(legs)).toEqual(
      [
        `external:${ALICE} debit ${post + 5000n} sent`,
        `external:${BOB} credit ${post} received`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );
    expectNoRentLegs(legs);
  });

  test("reduced rent, funded 1 SOL: full delta to the owner", async () => {
    const post = REDUCED_RESERVE + SOL;
    const { legs } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [BOB_ATA], readonly: [] },
      pre: [5n * SOL, 1n, 0n],
      post: [5n * SOL - post - 5000n, 1n, post],
      postTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: BOB, amount: SOL }],
    });
    expect(fmt(legs)).toEqual(
      [
        `external:${ALICE} debit ${post + 5000n} sent`,
        `external:${BOB} credit 1001855569 received`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );
    expectNoRentLegs(legs);
  });
});

describe("wSOL edge cases", () => {
  test("token owner missing: identity falls back to accountKeys[accountIndex], never the mint", async () => {
    const response = syntheticResponse({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [BOB_ATA], readonly: [] },
      pre: [5n * SOL, 1n, RENT],
      post: [4n * SOL - 5000n, 1n, RENT + SOL],
      preTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: BOB, amount: 0n }],
      postTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: BOB, amount: SOL }],
    }) as { meta: { preTokenBalances: Array<{ owner?: string }>; postTokenBalances: Array<{ owner?: string }> } };
    delete response.meta.preTokenBalances[0]!.owner;
    delete response.meta.postTokenBalances[0]!.owner;
    const { rpc } = mockRpc(() => response);
    const tx = (await fetchTransaction(rpc, SIG))!;
    const legs = fmt(transactionToLegs(tx));
    expect(legs).toContain(`external:${BOB_ATA} credit 1000000000 received`);
    expect(legs.some((l) => l.includes(WSOL_MINT))).toBe(false);
  });

  test("sync only (lamport delta zero, token amount changes): no leg is emitted", async () => {
    const { legs } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA], readonly: [] },
      pre: [SOL, 1n, RENT + 3n * SOL],
      post: [SOL - 5000n, 1n, RENT + 3n * SOL],
      preTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: ALICE, amount: SOL }],
      postTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: ALICE, amount: 3n * SOL }],
    });
    expect(fmt(legs)).toEqual(
      [`external:${ALICE} debit 5000 sent`, "fee:network credit 5000 fee"].sort(),
    );
  });
});

describe("transaction-level rewards (historical rent collection)", () => {
  test("nonzero rent rewards make the reconciliation unavailable, not unbalanced", async () => {
    const { tx } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      pre: [SOL, 1n],
      post: [SOL - 5000n - 1234n, 1n],
      rewards: [
        { pubkey: ALICE, lamports: -1234n, postBalance: SOL - 6234n, rewardType: "Rent" },
      ],
    });
    expect(tx.reconciliation?.status).toBe("unavailable");
    expect(tx.reconciliation?.reason).toContain("rewards present");
    expect(tx.reconciliation?.reason).toContain("Rent");
  });

  test("empty rewards keep the normal check", async () => {
    const { tx } = await legsFor({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      pre: [SOL, 1n],
      post: [SOL - 5000n, 1n],
      rewards: [],
    });
    expect(tx.reconciliation?.status).toBe("balanced");
  });
});

describe("fetchTransactionsBatch notifications", () => {
  test("a callback that throws on not_found propagates and is never relabelled", async () => {
    const { rpc } = mockRpc(() => null);
    const seen: SkippedTransaction[] = [];
    const fetchErrors: string[] = [];
    const error = await fetchTransactionsBatch(rpc, ["missing"] as Signature[], {
      onSkipped: (s) => {
        seen.push(s);
        throw new Error("callback exploded");
      },
      onFetchError: (sig) => fetchErrors.push(String(sig)),
    }).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("callback exploded");
    expect(seen).toEqual([{ signature: "missing", reason: "not_found" }]);
    expect(fetchErrors).toEqual([]);
  });

  test("exactly one notification per skipped signature", async () => {
    const { rpc } = mockRpc((sig) => {
      if (sig === "boom") throw new Error("upstream exploded");
      return null;
    });
    const seen: string[] = [];
    await fetchTransactionsBatch(rpc, ["a", "b", "boom"] as Signature[], {
      retry: { maxAttempts: 1 },
      onSkipped: (s) => seen.push(`${s.signature}:${s.reason}`),
    });
    expect(seen.sort()).toEqual(["a:not_found", "b:not_found", "boom:fetch_failed"]);
  });
});

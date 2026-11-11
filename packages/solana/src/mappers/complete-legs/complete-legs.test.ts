import { afterEach, describe, test, expect } from "bun:test";
import type { Address, Signature } from "@solana/kit";
import type { RawTransaction, TxLeg } from "@tx-indexer/core/tx/tx.types";
import { fetchTransaction } from "../../fetcher/transactions";
import { fetchTransactionsBatched } from "../../rpc/batch";
import { transactionToCompleteLegs as transactionToLegs } from "./transaction-to-legs";
import {
  extractTokenBalanceChanges,
  getWalletSolChangeExact as getWalletSolChange,
  getWalletTokenChangesExact as getWalletTokenChanges,
} from "./balance-parser";
import {
  SOL,
  mockRpc,
  syntheticResponse,
  WSOL_MINT,
  TOKEN_PROGRAM,
} from "../../__fixtures__/synthetic";

const SIG = "C1osedAccounts111111111111111111111111111111111111111111111111111111111111111111111111" as Signature;
const ALICE = "A1ice11111111111111111111111111111111111111";
const BOB = "Bob1111111111111111111111111111111111111111";
const ALICE_ATA = "A1iceATA111111111111111111111111111111111111";
const BOB_ATA = "BobATA11111111111111111111111111111111111111";
const MINT_A = "MintA11111111111111111111111111111111111111";
const MINT_B = "MintB11111111111111111111111111111111111111";
const RENT = 2039280n;

const fmt = (legs: TxLeg[]) =>
  legs.map((l) => `${l.accountId} ${l.side} ${l.amount.amountRaw} ${l.amount.token.mint.slice(0, 5)} ${l.role}`).sort();

type Input = Parameters<typeof syntheticResponse>[0];

async function fetchWith(input: Input, mutate?: (response: { meta: Record<string, unknown> }) => void) {
  const response = syntheticResponse(input) as unknown as { meta: Record<string, unknown> };
  mutate?.(response);
  const { rpc } = mockRpc(() => response);
  const tx = (await fetchTransaction(rpc, SIG))!;
  return { tx, legs: transactionToLegs(tx) };
}

/** Alice sells all of MINT_A (held in ALICE_ATA, index 2) and closes the account; rent goes back to her. */
const closeInput = (preOwner = ALICE): Input => ({
  staticKeys: [ALICE, TOKEN_PROGRAM],
  loaded: { writable: [ALICE_ATA, BOB_ATA], readonly: [] },
  pre: [SOL, 1n, RENT, RENT],
  post: [SOL + RENT - 5000n, 1n, 0n, RENT],
  preTokenBalances: [
    { accountIndex: 2, mint: MINT_A, owner: preOwner, amount: 750_000n, decimals: 6 },
    { accountIndex: 3, mint: MINT_A, owner: BOB, amount: 0n, decimals: 6 },
  ],
  postTokenBalances: [{ accountIndex: 3, mint: MINT_A, owner: BOB, amount: 750_000n, decimals: 6 }],
});

describe("closed token accounts (pre entry only)", () => {
  test("a closed non-native account yields an exact debit of its pre amount, attributed to its pre owner", async () => {
    const { tx, legs } = await fetchWith(closeInput());
    const changes = extractTokenBalanceChanges(tx);
    expect(changes.map((c) => [c.accountIndex, c.mint, c.owner, c.change.raw])).toEqual([
      [3, MINT_A, BOB, "750000"],
      [2, MINT_A, ALICE, "-750000"],
    ]);
    const closed = changes.find((c) => c.accountIndex === 2)!;
    expect(closed.preOwner).toBe(ALICE);
    expect(closed.postOwner).toBeUndefined();
    expect(closed.tokenAccount).toBe(ALICE_ATA);
    expect(closed.programId).toBe(TOKEN_PROGRAM);
    expect(closed.preBalance).toEqual({ raw: "750000", ui: 0.75 });
    expect(closed.postBalance).toEqual({ raw: "0", ui: 0 });
    expect(fmt(legs)).toEqual(
      [
        // the rent refund stays an ordinary lamport movement: nothing added or relabelled
        `external:${ALICE} credit ${RENT - 5000n} So111 received`,
        `external:${ALICE_ATA} debit ${RENT} So111 sent`,
        `fee:network credit 5000 So111 fee`,
        `external:${ALICE} debit 750000 MintA sent`,
        `external:${BOB} credit 750000 MintA received`,
      ].sort(),
    );
    expect(tx.reconciliation?.status).toBe("balanced");
    expect(tx.tokenBalanceStatus).toEqual({ status: "available" });
  });

  test("a closed account whose metadata has no owner falls back to the token account address, never the mint", async () => {
    const { tx, legs } = await fetchWith(closeInput(), (r) => {
      delete (r.meta.preTokenBalances as Array<{ owner?: string }>)[0]!.owner;
    });
    const closed = extractTokenBalanceChanges(tx).find((c) => c.accountIndex === 2)!;
    expect(closed.owner).toBeUndefined();
    const tokenLegs = legs.filter((l) => l.amount.token.mint === MINT_A);
    expect(fmt(tokenLegs)).toEqual(
      [`external:${ALICE_ATA} debit 750000 MintA sent`, `external:${BOB} credit 750000 MintA received`].sort(),
    );
    expect(legs.some((l) => l.accountId.includes(MINT_A))).toBe(false);
  });

  test("a post entry without owner also falls back to the token account address, never the mint", async () => {
    const { legs } = await fetchWith(closeInput(), (r) => {
      delete (r.meta.postTokenBalances as Array<{ owner?: string }>)[0]!.owner;
      delete (r.meta.preTokenBalances as Array<{ owner?: string }>)[1]!.owner;
    });
    expect(legs.filter((l) => l.amount.token.mint === MINT_A && l.side === "credit").map((l) => l.accountId)).toEqual([
      `external:${BOB_ATA}`,
    ]);
  });

  test("a closed wSOL account behaves exactly as before: lamport leg on the account, no token leg", async () => {
    const { tx, legs } = await fetchWith({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA], readonly: [] },
      pre: [SOL, 1n, RENT + 3n * SOL],
      post: [4n * SOL + RENT - 5000n, 1n, 0n],
      preTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: ALICE, amount: 3n * SOL }],
      postTokenBalances: [],
    });
    // The token-balance view does not extend to closed native accounts.
    expect(extractTokenBalanceChanges(tx)).toEqual([]);
    expect(fmt(legs)).toEqual(
      [
        `external:${ALICE} credit ${3n * SOL + RENT - 5000n} So111 received`,
        `external:${ALICE_ATA} debit ${3n * SOL + RENT} So111 sent`,
        `fee:network credit 5000 So111 fee`,
      ].sort(),
    );
    // exactly one movement out of the closed account: no double count
    expect(legs.filter((l) => l.side === "debit" && l.amount.token.mint === WSOL_MINT && l.accountId !== `external:${ALICE}`)).toHaveLength(1);
    expect(tx.reconciliation?.status).toBe("balanced");
  });
});

describe("same account index, different owner or mint: two separate movements", () => {
  test("authority change: the pre owner is debited, the post owner credited, never netted", async () => {
    const { tx, legs } = await fetchWith({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA], readonly: [] },
      pre: [SOL, 1n, RENT],
      post: [SOL - 5000n, 1n, RENT],
      preTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 500n, decimals: 6 }],
      postTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: BOB, amount: 500n, decimals: 6 }],
    });
    const changes = extractTokenBalanceChanges(tx);
    expect(changes.map((c) => [c.mint, c.owner, c.change.raw])).toEqual([
      [MINT_A, ALICE, "-500"],
      [MINT_A, BOB, "500"],
    ]);
    expect(fmt(legs.filter((l) => l.amount.token.mint === MINT_A))).toEqual(
      [`external:${ALICE} debit 500 MintA sent`, `external:${BOB} credit 500 MintA received`].sort(),
    );
  });

  test("close and reinitialise with another mint: the old mint is debited, the new mint credited, never netted", async () => {
    const { tx, legs } = await fetchWith({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA], readonly: [] },
      pre: [SOL, 1n, RENT],
      post: [SOL - 5000n, 1n, RENT],
      preTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 900n, decimals: 6 }],
      postTokenBalances: [{ accountIndex: 2, mint: MINT_B, owner: ALICE, amount: 300n, decimals: 2 }],
    });
    const changes = extractTokenBalanceChanges(tx);
    expect(changes.map((c) => [c.mint, c.owner, c.change.raw, c.tokenInfo.decimals])).toEqual([
      [MINT_A, ALICE, "-900", 6],
      [MINT_B, ALICE, "300", 2],
    ]);
    expect(fmt(legs.filter((l) => l.amount.token.mint !== WSOL_MINT))).toEqual(
      [`external:${ALICE} debit 900 MintA sent`, `external:${ALICE} credit 300 MintB received`].sort(),
    );
  });

  test("same owner and mint: one net change, as before", async () => {
    const { tx } = await fetchWith({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA], readonly: [] },
      pre: [SOL, 1n, RENT],
      post: [SOL - 5000n, 1n, RENT],
      preTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 900n, decimals: 6 }],
      postTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 400n, decimals: 6 }],
    });
    expect(extractTokenBalanceChanges(tx).map((c) => [c.owner, c.change.raw])).toEqual([[ALICE, "-500"]]);
  });
});

describe("negative cases: nothing is invented", () => {
  test("an owner missing on one side only is not an authority change: one net change, owner kept", async () => {
    for (const side of ["preTokenBalances", "postTokenBalances"] as const) {
      const { tx, legs } = await fetchWith(
        {
          staticKeys: [ALICE, TOKEN_PROGRAM],
          loaded: { writable: [ALICE_ATA], readonly: [] },
          pre: [SOL, 1n, RENT],
          post: [SOL - 5000n, 1n, RENT],
          preTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 900n, decimals: 6 }],
          postTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 400n, decimals: 6 }],
        },
        (r) => {
          delete (r.meta[side] as Array<{ owner?: string }>)[0]!.owner;
        },
      );
      expect(extractTokenBalanceChanges(tx).map((c) => [c.owner, c.change.raw])).toEqual([[ALICE, "-500"]]);
      expect(fmt(legs.filter((l) => l.amount.token.mint === MINT_A))).toEqual([`external:${ALICE} debit 500 MintA sent`]);
    }
  });

  test("closing an empty token account is no movement: no token change, no token leg", async () => {
    const { tx, legs } = await fetchWith({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA], readonly: [] },
      pre: [SOL, 1n, RENT],
      post: [SOL + RENT - 5000n, 1n, 0n],
      preTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 0n, decimals: 6 }],
      postTokenBalances: [],
    });
    expect(extractTokenBalanceChanges(tx)).toEqual([]);
    expect(legs.some((l) => l.amount.token.mint === MINT_A)).toBe(false);
  });
});

describe("debit vs credit comes from raw integer amounts", () => {
  test("a credit whose UI amount string reads 0 is still a credit of the exact raw amount", async () => {
    const { legs } = await fetchWith(
      {
        staticKeys: [ALICE, TOKEN_PROGRAM],
        loaded: { writable: [BOB_ATA], readonly: [] },
        pre: [SOL, 1n, 0n],
        post: [SOL - RENT - 5000n, 1n, RENT],
        postTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: BOB, amount: 1n, decimals: 9 }],
      },
      (r) => {
        (r.meta.postTokenBalances as Array<{ uiTokenAmount: { uiAmountString: string } }>)[0]!.uiTokenAmount.uiAmountString = "0";
      },
    );
    expect(fmt(legs.filter((l) => l.amount.token.mint === MINT_A))).toEqual([`external:${BOB} credit 1 MintA received`]);
  });
});

describe("unavailable token balance snapshots are not read as zeros", () => {
  for (const missing of ["preTokenBalances", "postTokenBalances"] as const) {
    test(`kit path: missing meta.${missing} -> no token changes, status unavailable`, async () => {
      const { tx, legs } = await fetchWith(closeInput(), (r) => {
        delete r.meta[missing];
      });
      // the fetch paths keep 1.6.x behaviour (missing array -> []); the status records it
      expect(tx[missing]).toEqual([]);
      expect(tx.tokenBalanceStatus?.status).toBe("unavailable");
      expect(tx.tokenBalanceStatus?.reason).toContain(missing);
      expect(extractTokenBalanceChanges(tx)).toEqual([]);
      expect(legs.some((l) => l.amount.token.mint === MINT_A)).toBe(false);
      // lamport legs and the reconciliation are untouched
      expect(tx.reconciliation?.status).toBe("balanced");
    });
  }

  test("kit path: empty arrays are an available snapshot", async () => {
    const { tx } = await fetchWith({ ...closeInput(), preTokenBalances: [], postTokenBalances: [] });
    expect(tx.preTokenBalances).toEqual([]);
    expect(tx.tokenBalanceStatus).toEqual({ status: "available" });
  });

  describe("JSON-RPC batch path (rpc/batch.ts)", () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    function jsonBody(input: Input, mutate?: (meta: Record<string, unknown>) => void) {
      const r = syntheticResponse(input) as unknown as { meta: Record<string, unknown> };
      mutate?.(r.meta);
      return JSON.parse(JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
    }

    async function batched(bodies: unknown[]): Promise<RawTransaction[]> {
      globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
        const requests = JSON.parse(String(init?.body)) as Array<{ id: number }>;
        return new Response(JSON.stringify(requests.map((q, i) => ({ jsonrpc: "2.0", id: q.id, result: bodies[i] }))), { status: 200 });
      }) as unknown as typeof fetch;
      return fetchTransactionsBatched("http://fixture.invalid", bodies.map((_, i) => `s${i}`) as Signature[], {
        requestsPerSecond: 0,
      });
    }

    test("closed account debit and unavailable snapshots match the kit path", async () => {
      const [ok, noPre] = await batched([jsonBody(closeInput()), jsonBody(closeInput(), (m) => delete m.preTokenBalances)]);
      const { tx: kitTx } = await fetchWith(closeInput());
      expect(fmt(transactionToLegs(ok!))).toEqual(fmt(transactionToLegs(kitTx)));
      expect(ok!.tokenBalanceStatus).toEqual({ status: "available" });
      expect(noPre!.preTokenBalances).toEqual([]);
      expect(noPre!.tokenBalanceStatus?.status).toBe("unavailable");
      expect(extractTokenBalanceChanges(noPre!)).toEqual([]);
    });
  });
});

describe("exact address comparison (base58 is case-sensitive)", () => {
  // Two distinct addresses that differ only by letter case.
  const LOWER = "abcdefghijkmnopqrstuvwxyz1111111111111111111";
  const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ11111111111111111111";
  const MIXED_A = "CaseWa11et111111111111111111111111111111111";
  const MIXED_B = "caseWa11et111111111111111111111111111111111";

  test("getWalletTokenChanges matches the owner exactly", async () => {
    const { tx } = await fetchWith({
      staticKeys: [MIXED_A, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA, BOB_ATA], readonly: [] },
      pre: [SOL, 1n, RENT, RENT],
      post: [SOL - 5000n, 1n, RENT, RENT],
      preTokenBalances: [
        { accountIndex: 2, mint: MINT_A, owner: MIXED_A, amount: 10n },
        { accountIndex: 3, mint: MINT_A, owner: MIXED_B, amount: 0n },
      ],
      postTokenBalances: [
        { accountIndex: 2, mint: MINT_A, owner: MIXED_A, amount: 0n },
        { accountIndex: 3, mint: MINT_A, owner: MIXED_B, amount: 10n },
      ],
    });
    expect(getWalletTokenChanges(tx, MIXED_A as Address).map((c) => [c.owner, c.change.raw])).toEqual([[MIXED_A, "-10"]]);
    expect(getWalletTokenChanges(tx, MIXED_B as Address).map((c) => [c.owner, c.change.raw])).toEqual([[MIXED_B, "10"]]);
  });

  test("getWalletSolChange matches the account key exactly", async () => {
    const { tx } = await fetchWith({
      staticKeys: [MIXED_A, MIXED_B, "11111111111111111111111111111111"],
      pre: [SOL, 0n, 1n],
      post: [SOL - 1000n - 5000n, 1000n, 1n],
      instructions: [{ programIdIndex: 2, accounts: [0, 1] }],
    });
    expect(getWalletSolChange(tx, MIXED_A as Address)?.change).toBe(-6000n);
    expect(getWalletSolChange(tx, MIXED_B as Address)?.change).toBe(1000n);
    expect(getWalletSolChange(tx, LOWER as Address)).toBeNull();
    expect(getWalletSolChange(tx, UPPER as Address)).toBeNull();
  });
});

describe("closure provenance on the leg (closedTokenAccount)", () => {
  const closedLegs = (legs: TxLeg[]) => legs.filter((l) => l.closedTokenAccount !== undefined);

  test("set exactly on the debit of an account closed in the transaction (pre entry only, zero lamports after)", async () => {
    const { tx, legs } = await fetchWith(closeInput());
    expect(extractTokenBalanceChanges(tx).map((c) => [c.accountIndex, c.accountClosed])).toEqual([
      [3, undefined],
      [2, true],
    ]);
    const flagged = closedLegs(legs);
    expect(flagged.length).toBe(1);
    expect(flagged[0]!.closedTokenAccount).toBe(ALICE_ATA);
    expect(flagged[0]!.side).toBe("debit");
    expect(flagged[0]!.amount.amountRaw).toBe("750000");
    expect(flagged[0]!.accountId).toBe(`external:${ALICE}`);
  });

  test("a proven closure without account keys keeps its debit but carries no fabricated address", async () => {
    const { tx } = await fetchWith(closeInput());
    const withoutKeys: RawTransaction = { ...tx, accountKeys: undefined };
    const legs = transactionToLegs(withoutKeys);
    // The field promises the token account's address: unknown address, no field.
    expect(closedLegs(legs)).toEqual([]);
    expect(JSON.stringify(legs)).not.toContain("account-index-");
    // The closed account's debit itself is still reported.
    const debit = legs.find((l) => l.side === "debit" && l.amount.amountRaw === "750000");
    expect(debit).toBeDefined();
    expect(debit!.closedTokenAccount).toBeUndefined();
  });

  test("a pre-only entry whose account still holds lamports is not flagged (closure not proven)", async () => {
    const input = closeInput();
    const { tx, legs } = await fetchWith({ ...input, post: [SOL - 5000n, 1n, RENT, RENT] });
    // the debit is still emitted, as an ordinary movement
    expect(fmt(legs.filter((l) => l.amount.token.mint === MINT_A))).toContain(`external:${ALICE} debit 750000 MintA sent`);
    expect(extractTokenBalanceChanges(tx).some((c) => c.accountClosed)).toBe(false);
    expect(closedLegs(legs)).toEqual([]);
  });

  test("a pre-only entry whose post lamport balance is unknown is not flagged", async () => {
    const { legs } = await fetchWith(closeInput(), (r) => {
      (r.meta.postBalances as unknown[]).length = 2;
    });
    expect(closedLegs(legs)).toEqual([]);
  });

  test("an owner change is not a closure, even when the account ends with zero lamports", async () => {
    const { legs } = await fetchWith({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA], readonly: [] },
      pre: [SOL, 1n, RENT],
      post: [SOL - 5000n + RENT, 1n, 0n],
      preTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 500n, decimals: 6 }],
      postTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: BOB, amount: 500n, decimals: 6 }],
    });
    expect(legs.some((l) => l.side === "debit" && l.amount.token.mint === MINT_A)).toBe(true);
    expect(closedLegs(legs)).toEqual([]);
  });

  test("a mint change on the same index (close and reinitialise) is not flagged", async () => {
    const { legs } = await fetchWith({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA], readonly: [] },
      pre: [SOL, 1n, RENT],
      post: [SOL - 5000n, 1n, RENT],
      preTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 900n, decimals: 6 }],
      postTokenBalances: [{ accountIndex: 2, mint: MINT_B, owner: ALICE, amount: 300n, decimals: 2 }],
    });
    expect(closedLegs(legs)).toEqual([]);
  });

  test("an account that goes to zero but stays open is not flagged; its closed sibling of the same owner and mint is", async () => {
    const SIBLING = "A1iceSib1ing1111111111111111111111111111111";
    const { legs } = await fetchWith({
      staticKeys: [ALICE, TOKEN_PROGRAM],
      loaded: { writable: [ALICE_ATA, SIBLING], readonly: [] },
      pre: [SOL, 1n, RENT, RENT],
      post: [SOL - 5000n + RENT, 1n, RENT, 0n],
      preTokenBalances: [
        { accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 1_000n, decimals: 6 },
        { accountIndex: 3, mint: MINT_A, owner: ALICE, amount: 300n, decimals: 6 },
      ],
      postTokenBalances: [{ accountIndex: 2, mint: MINT_A, owner: ALICE, amount: 0n, decimals: 6 }],
    });
    const debits = legs.filter((l) => l.side === "debit" && l.amount.token.mint === MINT_A);
    expect(debits.map((l) => [l.amount.amountRaw, l.closedTokenAccount]).sort()).toEqual([
      ["1000", undefined],
      ["300", SIBLING],
    ]);
  });
});

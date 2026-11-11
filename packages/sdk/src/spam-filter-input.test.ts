/**
 * The list spam filter reads the "v1-main" legs (its calibrated input), rebuilt from `tx` for
 * the queried wallet, never the returned truthful legs and never a per-object cache. Its
 * decisions must equal 3111fd7's on fresh, cached, cloned and deserialised transactions, and
 * with token enrichment on.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createIndexer, type ClassifiedTransaction } from "./client";
import { isSpamTransaction } from "@tx-indexer/core/tx/spam-filter";
import { mockRpc, syntheticResponse, SOL, TOKEN_PROGRAM, SYSTEM_PROGRAM } from "@tx-indexer/solana/__fixtures__/synthetic";

const SIG = "Sweep1111111111111111111111111111111111111111111111111111111111111111111111111111111111";
const ALICE = "A1ice11111111111111111111111111111111111111";
const BOB = "Bob1111111111111111111111111111111111111111";
const CAROL = "Caro1111111111111111111111111111111111111111";
const DAVE = "Dave1111111111111111111111111111111111111111";
const D_USDC = "DaveUSDC11111111111111111111111111111111111";
const C_USDC = "CaroUSDC11111111111111111111111111111111111";
const A_JUNK = "A1iceJunk1111111111111111111111111111111111";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUNK = "Junk111111111111111111111111111111111111111";
const RENT = 2_039_280n;
const tb = (accountIndex: number, mint: string, owner: string, amount: bigint, decimals: number) => ({ accountIndex, mint, owner, amount, decimals });

/** Dave sends Carol 5 USDC; Alice burns and closes 1,000 JUNK and receives 0.0005 SOL of the refund. */
export const DUST_REFUND_BESIDE_OTHER_TRANSFER = {
  staticKeys: [DAVE, ALICE, D_USDC, C_USDC, A_JUNK, TOKEN_PROGRAM],
  pre: [SOL, SOL, RENT, RENT, RENT, 1n],
  post: [SOL - 5000n + RENT - 500_000n, SOL + 500_000n, RENT, RENT, 0n, 1n],
  instructions: [{ programIdIndex: 5, accounts: [2, 3, 0] }],
  preTokenBalances: [tb(2, USDC, DAVE, 9_000_000n, 6), tb(3, USDC, CAROL, 0n, 6), tb(4, JUNK, ALICE, 1_000_000_000n, 6)],
  postTokenBalances: [tb(2, USDC, DAVE, 4_000_000n, 6), tb(3, USDC, CAROL, 5_000_000n, 6)],
};

/** Bob sends Carol 1 SOL; Alice's token account ends with 0.005 JUNK; preTokenBalances missing. */
export const LEGACY_ONLY_MINT = {
  staticKeys: [BOB, CAROL, ALICE, A_JUNK, SYSTEM_PROGRAM],
  pre: [10n * SOL, SOL, SOL, RENT, 1n],
  post: [9n * SOL - 5000n, 2n * SOL, SOL, RENT, 1n],
  instructions: [{ programIdIndex: 4, accounts: [0, 1] }],
  preTokenBalances: [],
  postTokenBalances: [tb(3, JUNK, ALICE, 5_000_000n, 9)],
};
const withoutPre = (input: typeof LEGACY_ONLY_MINT) => {
  const r = syntheticResponse(input) as unknown as { meta: Record<string, unknown> };
  delete r.meta.preTokenBalances;
  return r;
};
const JUNK_AS_SOL = { [JUNK]: { mint: JUNK, symbol: "SOL", name: "Not SOL", decimals: 9 } };

const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async () => {
    throw new Error("offline test");
  }) as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

const BIG = "__bigint__";
const jsonRoundTrip = <T>(v: T): T =>
  JSON.parse(
    JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? { [BIG]: x.toString() } : x)),
    (_k, x) => (x && typeof x === "object" && BIG in x ? BigInt(x[BIG]) : x),
  );

const noEnrich = { enrichNftMetadata: false, enrichTokenMetadata: false } as const;
const indexerFor = (response: () => unknown, customTokens?: Record<string, never> | typeof JUNK_AS_SOL) =>
  createIndexer({ client: { rpc: mockRpc(response).rpc as never }, ...(customTokens ? { customTokens } : {}) } as never);

/** One fresh fetch, captured through onFetched, as a cache would store it. */
async function fetchOnce(wallet: string): Promise<ClassifiedTransaction> {
  let stored: ClassifiedTransaction | null = null;
  await indexerFor(() => syntheticResponse(DUST_REFUND_BESIDE_OTHER_TRANSFER)).getTransactionsBySignatures([SIG], wallet, {
    ...noEnrich,
    filterSpam: false,
    onFetched: (t) => {
      stored = t;
    },
  });
  return stored!;
}

describe("dust refund beside another wallet's transfer: Alice is filtered on every path (as 3111fd7)", () => {
  const rows: Array<[string, (c: ClassifiedTransaction) => ClassifiedTransaction | null]> = [
    ["fresh fetch", () => null],
    ["cache returns the original object", (c) => c],
    ["cache returns a structuredClone", (c) => structuredClone(c)],
    ["cache returns a JSON round trip (bigints restored)", (c) => jsonRoundTrip(c)],
  ];
  for (const [name, fromCache] of rows) {
    test(name, async () => {
      const stored = await fetchOnce(ALICE);
      const cached = fromCache(stored);
      const listed = await indexerFor(() => syntheticResponse(DUST_REFUND_BESIDE_OTHER_TRANSFER)).getTransactionsBySignatures(
        [SIG],
        ALICE,
        { ...noEnrich, getCached: async () => cached },
      );
      expect(listed).toHaveLength(0);
      const all = await indexerFor(() => syntheticResponse(DUST_REFUND_BESIDE_OTHER_TRANSFER)).getTransactionsBySignatures(
        [SIG],
        ALICE,
        { ...noEnrich, filterSpam: false, getCached: async () => cached },
      );
      // a cached object's classification is served as stored and equals a fresh classification
      const semantic = (c: ClassifiedTransaction["classification"]) => {
        const { debugTrace, ...rest } = jsonRoundTrip(c);
        return { ...rest, selected: debugTrace?.selectedClassifier ?? null };
      };
      expect(semantic(all[0]!.classification)).toEqual(semantic(stored.classification));
    });
  }

  test("the returned legs show Alice's JUNK debit; fed those legs the filter would keep it", async () => {
    const t = await fetchOnce(ALICE);
    expect(t.legs.some((l) => l.closedTokenAccount === A_JUNK && l.accountId === `external:${ALICE}`)).toBe(true);
    expect(isSpamTransaction(t.tx, t.classification, {}, t.legs, ALICE)).toBe(false);
  });

  test("Carol (the real recipient) still sees it, fresh and from a JSON cache", async () => {
    const stored = await fetchOnce(CAROL);
    for (const cached of [null, jsonRoundTrip(stored)]) {
      const listed = await indexerFor(() => syntheticResponse(DUST_REFUND_BESIDE_OTHER_TRANSFER)).getTransactionsBySignatures(
        [SIG],
        CAROL,
        { ...noEnrich, getCached: async () => cached },
      );
      expect(listed).toHaveLength(1);
    }
  });

  test("getTransactions-style batch path: same decision", async () => {
    const listed = await indexerFor(() => syntheticResponse(DUST_REFUND_BESIDE_OTHER_TRANSFER)).getTransactionsBySignatures([SIG], ALICE, noEnrich);
    expect(listed).toHaveLength(0);
  });
});

describe("legacy-only mint: the filter legs are enriched from their own mints (as 3111fd7)", () => {
  test("Alice's 0.005 JUNK credit, configured with symbol SOL, keeps the transaction listed", async () => {
    const listed = await indexerFor(() => withoutPre(LEGACY_ONLY_MINT), JUNK_AS_SOL).getTransactionsBySignatures([SIG], ALICE, {
      enrichNftMetadata: false,
      enrichTokenMetadata: true,
    });
    expect(listed).toHaveLength(1);
    // the public legs have no JUNK leg (snapshot unavailable), so only the filter legs carry it
    expect(listed[0]!.legs.some((l) => l.amount.token.mint === JUNK)).toBe(false);
  });

  test("without enrichment the fallback symbol applies and it is filtered, as 3111fd7", async () => {
    const listed = await indexerFor(() => withoutPre(LEGACY_ONLY_MINT), JUNK_AS_SOL).getTransactionsBySignatures([SIG], ALICE, noEnrich);
    expect(listed).toHaveLength(0);
  });
});

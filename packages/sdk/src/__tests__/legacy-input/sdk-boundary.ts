/**
 * Runs corpus entries through the SDK methods of a source tree (dynamic imports from `root`),
 * so the same code produces the 3111fd7 expectations (generate-sdk-boundary.ts) and checks
 * this tree (../../sdk-boundary.test.ts). Deterministic token metadata: `customTokens` below,
 * network stubbed (unknown mints get the fetcher's fallback).
 *
 * Every SDK output is recorded in JSON-normal form with the ADDITIVE fields removed
 * (`completeLegs` on the classified transaction, `tokenBalanceStatus` on `tx`; both absent at
 * 3111fd7) and the trace reduced to its selecting classifier, so the comparison covers `tx`,
 * `legs` and the classification of every returned transaction. Covered:
 * - getTransaction and getTransactionsBySignatures (enrichment off);
 * - list decisions fresh, from a serialised cache and without enrichment (default filter);
 * - getTransactions over a two-page signature listing with `limit: 1` (page one = the corpus
 *   entry, page two = a plain 1 SOL receive), enrichment off and on: the signature cursors
 *   requested, the transactions fetched and the returned list;
 * - the cache matrix: written with enrichment off/on x read off/on x served as the original
 *   object / a structuredClone / a JSON round trip, plus a cached object whose
 *   postTokenBalances were stripped (legs stored);
 * - getTokens rejecting (rejecting-tokens.ts, in a child process): every method's outcome
 *   (result or error) must be the base one.
 * Full outputs are stored as `{ listed, sha256 }` of their canonical JSON (sorted keys), to
 * keep the expectations file small; classifications, cursors, fetches and errors are stored
 * as they are.
 */
import { createHash } from "node:crypto";
import { join } from "node:path";
import { SYNTHETIC_SIGNATURE, syntheticResponseFor, type CorpusItem } from "./corpus";
import { normal } from "./runner";

export const BOUNDARY_IDS = [
  "accuracy:swap-pump-amm-sell-all-and-close",
  "accuracy:transfer-token2022-sponsored-fee-then-close",
  "accuracy:liquidity-add-damm-v2-by-keeper",
  "close-sell",
  "airdrop-on-dex-plus-burned-junk",
  "neg-burn-plus-independent-mint-plus-usdc-receive",
  "neg-swap-plus-closed-sibling-sends-30w-to-carol",
  "neg-buy-missing-pre-snapshot",
  "transfer-other-wallets-token-beside-own-rent",
  "filter-dust-refund-beside-other-transfer",
  "filter-legacy-only-mint",
];

const JUNK = "Junk111111111111111111111111111111111111111";
export const CUSTOM_TOKENS = { [JUNK]: { mint: JUNK, symbol: "SOL", name: "Not SOL", decimals: 9 } };

/** Page two of the getTransactions listing: a plain 1 SOL receive by the wallet. */
export const FILLER_SIGNATURE =
  "33kveXj6LuW9ZKNJu1fB9kAozse69GsR3nnd9NNADf4nWug2erPjsLQkNCWWeHSoiHpftD8sjr82VQmnwzChmifg";
const FILLER_SENDER = "Fi11erSender1111111111111111111111111111111";
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

type Classified = { tx: Record<string, unknown>; legs: unknown[]; classification: Record<string, unknown> } & Record<
  string,
  unknown
>;

export interface Outcome {
  error?: string;
  result?: unknown;
}

export interface BoundaryResult {
  id: string;
  wallet: string;
  /** getTransaction, enrichment off: semantic classification and selecting classifier. */
  getTransaction: { classification: unknown; selected: string | null };
  /** getTransactionsBySignatures, enrichment off, no filter. */
  bySignatures: { classification: unknown; selected: string | null };
  /** List decisions, default spam config, token enrichment on (deterministic metadata). */
  listedFresh: number;
  listedFromSerialisedCache: number;
  listedNoEnrichment: number;
  /** Full outputs (additive fields removed) of the methods above, as digests. */
  outputs: Record<string, unknown>;
  /** getTransactions, two pages, limit 1. */
  getTransactions: Record<"off" | "on", { cursors: Array<string | null>; fetched: string[]; returned: unknown; selected: unknown }>;
  /** The cache matrix: list returned by getTransactionsBySignatures for each combination. */
  cache: Record<string, unknown>;
}

const BIG = "__bigint__";
export const jsonRoundTrip = <T>(v: T): T =>
  JSON.parse(
    JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? { [BIG]: x.toString() } : x)),
    (_k, x) => (x && typeof x === "object" && BIG in x ? BigInt(x[BIG]) : x),
  );

const semantic = (c: { debugTrace?: { selectedClassifier: string | null } } & Record<string, unknown>) => {
  const { debugTrace, ...rest } = c;
  return { classification: normal(rest), selected: debugTrace?.selectedClassifier ?? null };
};

/** JSON-normal output with the additive fields removed and the trace reduced to its selector. */
export function comparable(t: Classified | null | undefined): unknown {
  if (!t) return t ?? null;
  const { completeLegs: _c, tx, classification, ...rest } = t;
  const { tokenBalanceStatus: _s, ...txRest } = tx;
  return normal({ ...rest, tx: txRest, ...semantic(classification as never) });
}
const comparableList = (list: Classified[]) => list.map(comparable);

const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])]))
      : v;
/** Compact, order-insensitive (object keys) fingerprint of a comparable output. */
export const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");
const listDigest = (list: Classified[]) => ({ listed: list.length, sha256: digest(comparableList(list)) });

export async function outcome(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    const r = await run();
    return { result: Array.isArray(r) ? listDigest(r as Classified[]) : digest(comparable(r as Classified)) };
  } catch (e) {
    return { error: `${(e as Error)?.constructor?.name}: ${(e as Error)?.message}` };
  }
}

export async function loadSdk(root: string) {
  const { createIndexer } = await import(join(root, "packages/sdk/src/client"));
  const { mockRpc, syntheticResponse } = await import(join(root, "packages/solana/src/__fixtures__/synthetic"));
  const { createFixtureRpc } = await import(join(root, "packages/solana/src/__fixtures__/fixture-rpc"));
  return { createIndexer, mockRpc, syntheticResponse, createFixtureRpc };
}
type Sdk = Awaited<ReturnType<typeof loadSdk>>;

/** RPC for one corpus entry; with `paged`, also a two-page getSignaturesForAddress listing. */
export function rpcFor(sdk: Sdk, item: CorpusItem, wallet: string) {
  const signature = item.kind === "body" ? item.signature : SYNTHETIC_SIGNATURE;
  const itemRpc = () =>
    item.kind === "body" ? sdk.createFixtureRpc({ [item.signature]: item.body }).rpc : sdk.mockRpc(() => syntheticResponseFor(item)).rpc;
  const filler = () =>
    sdk.syntheticResponse({
      staticKeys: [FILLER_SENDER, wallet, SYSTEM_PROGRAM],
      pre: [10_000_000_000n, 1_000_000_000n, 1n],
      post: [8_999_995_000n, 2_000_000_000n, 1n],
    });
  const paged = () => {
    const inner = itemRpc();
    const fill = sdk.mockRpc(filler).rpc;
    const cursors: Array<string | null> = [];
    const fetched: string[] = [];
    const order = [signature, FILLER_SIGNATURE];
    const rpc = {
      getTransaction: (s: unknown, cfg: unknown) => {
        fetched.push(String(s));
        return String(s) === signature ? inner.getTransaction(s, cfg) : fill.getTransaction(s, cfg);
      },
      getSignaturesForAddress: (_a: unknown, o: { limit?: number; before?: unknown }) => ({
        send: async () => {
          cursors.push(o.before === undefined ? null : String(o.before));
          const start = o.before === undefined ? 0 : order.indexOf(String(o.before)) + 1;
          return order.slice(start, start + (o.limit ?? 1000)).map((s, i) => ({
            signature: s,
            slot: BigInt(2000 - start - i),
            blockTime: BigInt(1700000000 - start - i),
            err: null,
            memo: null,
          }));
        },
      }),
    };
    return { rpc, cursors, fetched };
  };
  return { signature, itemRpc, paged };
}

const off = { enrichNftMetadata: false, enrichTokenMetadata: false };
const on = { enrichNftMetadata: false, enrichTokenMetadata: true };
export const PAGED = { limit: 1, minPageSize: 1, overfetchMultiplier: 1, maxIterations: 5 };

export async function runBoundary(root: string, item: CorpusItem, wallet: string): Promise<BoundaryResult> {
  const sdk = await loadSdk(root);
  const { signature, itemRpc, paged } = rpcFor(sdk, item, wallet);
  const indexer = () => sdk.createIndexer({ client: { rpc: itemRpc() }, customTokens: CUSTOM_TOKENS });

  const single = await indexer().getTransaction(signature, { walletAddress: wallet, ...off });
  const [bySig] = await indexer().getTransactionsBySignatures([signature], wallet, { ...off, filterSpam: false });

  /** One fresh fetch with the given enrichment, captured as a cache would store it. */
  const write = async (enrich: typeof on) => {
    let stored: Classified | null = null;
    await indexer().getTransactionsBySignatures([signature], wallet, {
      ...enrich,
      filterSpam: false,
      onFetched: (t: Classified) => (stored = t),
    });
    return stored!;
  };
  const fresh = await indexer().getTransactionsBySignatures([signature], wallet, on);
  const storedOn = await write(on);
  const storedOff = await write(off);
  const fromCache = await indexer().getTransactionsBySignatures([signature], wallet, {
    ...on,
    getCached: async () => jsonRoundTrip(storedOn),
  });
  const noEnrich = await indexer().getTransactionsBySignatures([signature], wallet, off);

  const getTransactions = {} as BoundaryResult["getTransactions"];
  for (const [name, enrich] of [["off", off], ["on", on]] as const) {
    const p = paged();
    const list = await sdk
      .createIndexer({ client: { rpc: p.rpc }, customTokens: CUSTOM_TOKENS })
      .getTransactions(wallet, { ...PAGED, ...enrich });
    getTransactions[name] = {
      cursors: p.cursors,
      fetched: p.fetched,
      returned: listDigest(list),
      selected: list.map((t: Classified) => [String(t.tx.signature), semantic(t.classification as never).selected]),
    };
  }

  const forms: Array<[string, (c: Classified) => Classified]> = [
    ["original", (c) => c],
    ["structuredClone", (c) => structuredClone(c)],
    ["json", (c) => jsonRoundTrip(c)],
  ];
  const stripPost = (c: Classified): Classified => {
    const { postTokenBalances: _p, ...tx } = c.tx;
    return { ...c, tx };
  };
  const cache: Record<string, unknown> = {};
  for (const [wName, stored] of [["written-off", storedOff], ["written-on", storedOn]] as const) {
    for (const [rName, read] of [["read-off", off], ["read-on", on]] as const) {
      for (const [fName, form] of forms) {
        for (const [sName, strip] of [["", (c: Classified) => c], ["/postTokenBalances-stripped", stripPost]] as const) {
          if (sName && wName === "written-off") continue;
          const cached = form(strip(stored));
          const list = await indexer().getTransactionsBySignatures([signature], wallet, {
            ...read,
            getCached: async () => cached,
          });
          cache[`${wName}/${rName}/${fName}${sName}`] = listDigest(list);
        }
      }
    }
  }

  return {
    id: item.id,
    wallet,
    getTransaction: semantic(single!.classification),
    bySignatures: semantic(bySig.classification),
    listedFresh: fresh.length,
    listedFromSerialisedCache: fromCache.length,
    listedNoEnrichment: noEnrich.length,
    outputs: {
      getTransaction: digest(comparable(single)),
      bySignatures: digest(comparable(bySig)),
      fresh: listDigest(fresh),
      noEnrich: listDigest(noEnrich),
    },
    getTransactions,
    cache,
  };
}

/**
 * Runs corpus entries through the SDK methods of a source tree (dynamic imports from `root`),
 * so the same code produces the 3111fd7 expectations (generate-sdk-boundary.ts) and checks
 * this tree (../../sdk-boundary.test.ts). Deterministic token metadata: `customTokens` below,
 * network stubbed (unknown mints get the fetcher's fallback). The cache serialises: entries
 * pass through a JSON round trip with bigints restored.
 */
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

export async function runBoundary(root: string, item: CorpusItem, wallet: string): Promise<BoundaryResult> {
  const { createIndexer } = await import(join(root, "packages/sdk/src/client"));
  const { mockRpc } = await import(join(root, "packages/solana/src/__fixtures__/synthetic"));
  const { createFixtureRpc } = await import(join(root, "packages/solana/src/__fixtures__/fixture-rpc"));
  const signature = item.kind === "body" ? item.signature : SYNTHETIC_SIGNATURE;
  const rpc = () =>
    item.kind === "body" ? createFixtureRpc({ [item.signature]: item.body }).rpc : mockRpc(() => syntheticResponseFor(item)).rpc;
  const indexer = () => createIndexer({ client: { rpc: rpc() }, customTokens: CUSTOM_TOKENS });
  const off = { enrichNftMetadata: false, enrichTokenMetadata: false };
  const on = { enrichNftMetadata: false, enrichTokenMetadata: true };

  const single = await indexer().getTransaction(signature, { walletAddress: wallet, ...off });
  const [bySig] = await indexer().getTransactionsBySignatures([signature], wallet, { ...off, filterSpam: false });
  let stored: unknown = null;
  const fresh = await indexer().getTransactionsBySignatures([signature], wallet, {
    ...on,
    onFetched: (t: unknown) => {
      stored = t;
    },
  });
  if (!stored) {
    await indexer().getTransactionsBySignatures([signature], wallet, { ...on, filterSpam: false, onFetched: (t: unknown) => (stored = t) });
  }
  const cached = jsonRoundTrip(stored);
  const fromCache = await indexer().getTransactionsBySignatures([signature], wallet, { ...on, getCached: async () => cached });
  const noEnrich = await indexer().getTransactionsBySignatures([signature], wallet, off);
  return {
    id: item.id,
    wallet,
    getTransaction: semantic(single!.classification),
    bySignatures: semantic(bySig.classification),
    listedFresh: fresh.length,
    listedFromSerialisedCache: fromCache.length,
    listedNoEnrichment: noEnrich.length,
  };
}

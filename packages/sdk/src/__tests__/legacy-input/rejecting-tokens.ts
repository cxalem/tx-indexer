/**
 * Child process for the SDK-boundary guard: replaces the token fetcher of the tree at <root>
 * with one whose getTokens/getToken reject, then records every method's outcome (result in
 * comparable form, or the error) for the BOUNDARY_IDS entries: enrichment on, enrichment off,
 * and reads served from a cache (written without enrichment) with enrichment on. Prints JSON.
 *
 *   bun packages/sdk/src/__tests__/legacy-input/rejecting-tokens.ts <root>
 *
 * Its own process because the module replacement is process-wide.
 */
import { mock } from "bun:test";
import { join } from "node:path";
import { corpus } from "./corpus";
import { BOUNDARY_IDS, CUSTOM_TOKENS, loadSdk, outcome, PAGED, rpcFor } from "./sdk-boundary";

const root = process.argv[2];
if (!root) throw new Error("usage: bun rejecting-tokens.ts <root>");
globalThis.fetch = (async () => {
  throw new Error("sdk boundary: network access is not allowed");
}) as unknown as typeof fetch;
console.warn = () => {};

const path = join(root, "packages/domain/src/money/token-fetcher.ts");
const real = { ...(await import(path)) }; // a copy: the module namespace is live and gets replaced
const createReal = real.createTokenFetcher;
let rejections = 0;
const reject = async () => {
  rejections++;
  throw new Error("getTokens rejected (test)");
};
mock.module(path, () => ({
  ...real,
  createTokenFetcher: (o: unknown) => ({ ...createReal(o), getTokens: reject, getToken: reject }),
}));

const sdk = await loadSdk(root);
const on = { enrichNftMetadata: false, enrichTokenMetadata: true };
const off = { enrichNftMetadata: false, enrichTokenMetadata: false };
const BIG = "__bigint__";
const jsonRoundTrip = <T>(v: T): T =>
  JSON.parse(
    JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? { [BIG]: x.toString() } : x)),
    (_k, x) => (x && typeof x === "object" && BIG in x ? BigInt(x[BIG]) : x),
  );
const results = [];
for (const item of corpus().filter((i) => BOUNDARY_IDS.includes(i.id))) {
  for (const wallet of item.perspectives) {
    if (!wallet) continue;
    const { signature, itemRpc, paged } = rpcFor(sdk, item, wallet);
    const indexer = (rpc: unknown) => sdk.createIndexer({ client: { rpc }, customTokens: CUSTOM_TOKENS });
    results.push({
      id: item.id,
      wallet,
      getTransaction: await outcome(() => indexer(itemRpc()).getTransaction(signature, { walletAddress: wallet, ...on })),
      bySignatures: await outcome(() => indexer(itemRpc()).getTransactionsBySignatures([signature], wallet, on)),
      bySignaturesNoFilter: await outcome(() =>
        indexer(itemRpc()).getTransactionsBySignatures([signature], wallet, { ...on, filterSpam: false }),
      ),
      getTransactions: await outcome(() => indexer(paged().rpc).getTransactions(wallet, { ...PAGED, ...on })),
      getTransactionOff: await outcome(() => indexer(itemRpc()).getTransaction(signature, { walletAddress: wallet, ...off })),
      bySignaturesOff: await outcome(() => indexer(itemRpc()).getTransactionsBySignatures([signature], wallet, off)),
      getTransactionsOff: await outcome(() => indexer(paged().rpc).getTransactions(wallet, { ...PAGED, ...off })),
      cachedReadOn: await outcome(async () => {
        let stored: unknown = null;
        await indexer(itemRpc()).getTransactionsBySignatures([signature], wallet, {
          ...off,
          filterSpam: false,
          onFetched: (t: unknown) => (stored = t),
        });
        const results = [];
        for (const cached of [stored, structuredClone(stored), jsonRoundTrip(stored)]) {
          results.push(...(await indexer(itemRpc()).getTransactionsBySignatures([signature], wallet, { ...on, getCached: async () => cached })));
        }
        return results;
      }),
    });
  }
}
console.log(JSON.stringify({ rejections, results }));

/**
 * The additive `completeLegs` field at the SDK boundary:
 * - over the whole oracle corpus, getTransaction returns `legs` deep-equal to 3111fd7's
 *   (oracle.3111fd7.json) next to `completeLegs` (perspectives that are not valid addresses,
 *   which getTransaction rejects as at 3111fd7, are covered by the mapper-level oracle);
 * - `closedTokenAccount` appears only on debits of proven closures (pre token entry, no post
 *   entry, both snapshots available, post lamports zero), and the corpus contains such debits;
 * - it survives toJsonClassifiedTransaction and a JSON round trip;
 * - an object from an older cache (no `completeLegs`) is served as stored and nothing needs it.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isAddress } from "@solana/kit";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { createIndexer, type ClassifiedTransaction } from "./client";
import { toJsonClassifiedTransaction } from "./json-types";
import { corpus, type CorpusItem } from "./__tests__/legacy-input/corpus";
import { normal, type OracleEntry } from "./__tests__/legacy-input/runner";
import { jsonRoundTrip, loadSdk, rpcFor } from "./__tests__/legacy-input/sdk-boundary";

const REPO = join(import.meta.dir, "../../..");
const oracle = JSON.parse(
  readFileSync(join(import.meta.dir, "__tests__/legacy-input/oracle.3111fd7.json"), "utf8"),
) as { entries: OracleEntry[] };
const off = { enrichNftMetadata: false, enrichTokenMetadata: false } as const;

const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async () => {
    throw new Error("offline test");
  }) as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

const sdk = await loadSdk(REPO);
async function fetchClassified(item: CorpusItem, wallet: string | null) {
  const { signature, itemRpc } = rpcFor(sdk, item, wallet ?? "11111111111111111111111111111111");
  return (await createIndexer({ client: { rpc: itemRpc() } } as never).getTransaction(signature, {
    ...off,
    ...(wallet ? { walletAddress: wallet } : {}),
  })) as ClassifiedTransaction | null;
}

/** Proven closure: pre token entry, no post entry, snapshots available, post lamports zero. */
function provenClosure(t: ClassifiedTransaction, account: string): boolean {
  const { tx } = t;
  const idx = tx.accountKeys?.indexOf(account) ?? -1;
  if (idx < 0 || tx.tokenBalanceStatus?.status !== "available") return false;
  const inPre = (tx.preTokenBalances ?? []).some((b) => b.accountIndex === idx);
  const inPost = (tx.postTokenBalances ?? []).some((b) => b.accountIndex === idx);
  return inPre && !inPost && BigInt(tx.postBalances?.[idx] ?? -1) === 0n;
}

describe("completeLegs over the oracle corpus", async () => {
  const items = corpus();
  let flagged = 0;
  let differing = 0;
  for (const item of items) {
    for (const wallet of item.perspectives) {
      const want = oracle.entries.find((e) => e.id === item.id && e.perspective === wallet)!;
      if (want.error || (wallet && !isAddress(wallet))) continue;
      test(`${item.id} @${wallet ?? "-"}`, async () => {
        const t = (await fetchClassified(item, wallet))!;
        expect(normal(t.legs)).toEqual(want.legs!);
        expect(Array.isArray(t.completeLegs)).toBe(true);
        for (const leg of t.completeLegs as TxLeg[]) {
          if (leg.closedTokenAccount === undefined) continue;
          flagged++;
          expect(leg.side).toBe("debit");
          expect(provenClosure(t, leg.closedTokenAccount)).toBe(true);
        }
        expect(t.legs.some((l) => "closedTokenAccount" in l)).toBe(false);
        if (JSON.stringify(normal(t.completeLegs)) !== JSON.stringify(normal(t.legs))) differing++;
      });
    }
  }
  test("the corpus exercises closed-account debits and differing complete legs", () => {
    expect(flagged).toBeGreaterThan(0);
    expect(differing).toBeGreaterThan(0);
  });
});

describe("serialisation and older caches", () => {
  const item = corpus().find((i) => i.id === "close-sell")!;
  const wallet = item.perspectives.find(Boolean)!;

  test("toJsonClassifiedTransaction keeps completeLegs and closedTokenAccount; JSON round trip too", async () => {
    const t = (await fetchClassified(item, wallet))!;
    const closed = t.completeLegs!.filter((l) => l.closedTokenAccount);
    expect(closed.length).toBeGreaterThan(0);
    const json = JSON.parse(JSON.stringify(toJsonClassifiedTransaction(t)));
    expect(json.completeLegs).toHaveLength(t.completeLegs!.length);
    expect(json.completeLegs.filter((l: { closedTokenAccount?: string }) => l.closedTokenAccount).map((l: { closedTokenAccount: string }) => l.closedTokenAccount)).toEqual(
      closed.map((l) => l.closedTokenAccount),
    );
    expect(json.legs).toEqual(toJsonClassifiedTransaction({ ...t, completeLegs: undefined }).legs.map((l) => JSON.parse(JSON.stringify(l))));
    expect(jsonRoundTrip(t).completeLegs).toEqual(t.completeLegs);
    // without the field, the JSON form has no completeLegs key
    expect("completeLegs" in toJsonClassifiedTransaction({ ...t, completeLegs: undefined })).toBe(false);
  });

  test("an older cached object (no completeLegs) is served as stored, with enrichment on or off", async () => {
    const t = (await fetchClassified(item, wallet))!;
    const { completeLegs: _drop, ...old } = t;
    for (const enrich of [false, true]) {
      const { signature, itemRpc } = rpcFor(sdk, item, wallet);
      const [served] = await createIndexer({ client: { rpc: itemRpc() } } as never).getTransactionsBySignatures([signature], wallet, {
        enrichNftMetadata: false,
        enrichTokenMetadata: enrich,
        filterSpam: false,
        getCached: async () => jsonRoundTrip(old) as ClassifiedTransaction,
      });
      expect(served!.completeLegs).toBeUndefined();
      expect(normal(served!.legs)).toEqual(normal(t.legs));
    }
  });
});

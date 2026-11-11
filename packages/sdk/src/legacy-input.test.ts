/**
 * `legs` ("v1-main"), classification and the additive `completeLegs`: fidelity to 3111fd7.
 *
 * __tests__/legacy-input/oracle.3111fd7.json was produced by generate-oracle.ts running the
 * 3111fd7 tree on the corpus (recorded mainnet fixtures, all accuracy cases x perspectives,
 * synthetic cases). For every entry this tree must produce:
 * 1. the identical ORDERED `legs` array (transactionToLegs, unchanged from 3111fd7);
 * 2. for each of the eleven classifiers (all read "v1-main"), the identical output (null,
 *    amounts, participants, relevance, confidence, metadata) on those legs;
 * 3. the identical FINAL classification and selecting classifier, both as the SDK runs it
 *    (classifyTransaction(legs, tx, wallet)) and with the optional `{ completeLegs }` engine
 *    context. No exceptions.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { corpus, LEGACY_CLASSIFIERS } from "./__tests__/legacy-input/corpus";
import { loadTree, runItem, type OracleEntry } from "./__tests__/legacy-input/runner";

const REPO = join(import.meta.dir, "../../..");
const oracle = JSON.parse(
  readFileSync(join(import.meta.dir, "__tests__/legacy-input/oracle.3111fd7.json"), "utf8"),
) as { base: string; entries: OracleEntry[] };

const key = (e: { id: string; perspective: string | null }) => `${e.id} @${e.perspective ?? "-"}`;

describe("v1-main legs, every classifier and the final result equal 3111fd7 (oracle)", async () => {
  const tree = await loadTree(REPO);
  const items = corpus();
  const expected = new Map(oracle.entries.map((e) => [key(e), e]));

  test("the oracle covers exactly the corpus", () => {
    const keys = items.flatMap((i) => i.perspectives.map((p) => key({ id: i.id, perspective: p })));
    expect([...expected.keys()].sort()).toEqual(keys.sort());
    expect(oracle.base).toBe("3111fd7");
  });

  for (const item of items) {
    for (const perspective of item.perspectives) {
      const k = key({ id: item.id, perspective });
      test(k, async () => {
        const want = expected.get(k)!;
        const got = await runItem(tree, item, perspective, "routed");
        if (want.error) {
          expect(got.error).toBe(want.error);
          return;
        }
        expect(got.error).toBeUndefined();
        expect(got.legs).toEqual(want.legs!);
        for (const [name] of LEGACY_CLASSIFIERS) {
          expect({ [name]: got.perClassifier![name] }).toEqual({ [name]: want.perClassifier![name] });
        }
        expect(got.final).toEqual(want.final);
        expect(got.finalClassifier).toBe(want.finalClassifier!);
        expect(got.finalWithComplete).toEqual(want.final);
        expect(got.finalWithCompleteClassifier).toBe(want.finalClassifier!);
      });
    }
  }
});

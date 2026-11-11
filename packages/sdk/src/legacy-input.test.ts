/**
 * "v1-main" compatibility input: fidelity to 3111fd7.
 *
 * __tests__/legacy-input/oracle.3111fd7.json was produced by generate-oracle.ts running the
 * 3111fd7 tree on the corpus (recorded mainnet fixtures, all accuracy cases x perspectives,
 * synthetic cases). For every entry this tree must produce:
 * 1. the identical ORDERED "v1-main" leg array;
 * 2. for each of the ten legacy classifiers (every classifier except swap), the identical
 *    output (null, amounts, participants, relevance, confidence, metadata) on those legs;
 * 3. for EVERY entry, the identical FINAL classification and selecting classifier through the
 *    routed pipeline (truthful legs + `{ legacyLegs }`), except the entries listed in
 *    SWAP_SELECTED below: there the branch's final result is selected by `swap`, the only
 *    classifier that reads the truthful "v2-closed-token-accounts" legs.
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

const ALICE = "A1ice11111111111111111111111111111111111111";
/**
 * The only entries whose final result may differ from 3111fd7. Each one must be selected by
 * `swap` on this branch; any other difference fails the test.
 */
const SWAP_SELECTED: Record<string, string> = {
  [`close-sell @${ALICE}`]:
    "the sold token account is closed in the same transaction; 3111fd7 lost the sale and reported the rent refund as a transfer",
  "close-sell @-":
    "same transaction from the fee payer's view (no wallet): the closed account's sale becomes visible to swap",
  [`post-entry-without-owner @${ALICE}`]:
    "same sale-and-close where the post entry has no owner; the closed debit still resolves to Alice's sale",
  [`mint-change-same-index @${ALICE}`]:
    "the account index is reused for a different mint after the close; 3111fd7 merged both mints and saw nothing",
  [`swap-sell-and-close-vault-credited @${ALICE}`]:
    "a sell-all into a pool vault with the account closed; 3111fd7 reported the SOL proceeds as a transfer from the vault",
  "accuracy:swap-pump-amm-sell-all-and-close @32ktkabAVmaoKDRuo7rgQsP38zBB4p8SFyCyogn1yCyt":
    "the labelled pump AMM sell-all-and-close: 3111fd7 said transfer (wrong label), the branch says swap (expected kind)",
};

describe("v1-main legs and legacy classifiers equal 3111fd7 (oracle)", async () => {
  const tree = await loadTree(REPO);
  const items = corpus();
  const expected = new Map(oracle.entries.map((e) => [key(e), e]));

  test("every allowed difference names an oracle entry", () => {
    for (const k of Object.keys(SWAP_SELECTED)) expect(expected.has(k)).toBe(true);
  });

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
        if (k in SWAP_SELECTED) {
          expect(got.finalClassifier).toBe("swap");
          expect(got.final).not.toEqual(want.final);
          return;
        }
        expect(got.final).toEqual(want.final);
        expect(got.finalClassifier).toBe(want.finalClassifier!);
      });
    }
  }
});

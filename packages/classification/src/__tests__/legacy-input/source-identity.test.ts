/**
 * Every classifier (all read the "v1-main" input, i.e. `legs`), the helpers they share, the
 * protocol detector, the mapper that builds `legs` and the list spam filter must be
 * byte-identical to commit 3111fd7: `git diff 3111fd7 -- <files>` is empty. Behaviour is
 * proven by packages/sdk/src/legacy-input.test.ts; a git-independent digest check of the whole
 * runtime closure of classify + filter is packages/sdk/src/legacy-digests.test.ts.
 * Needs git and the commit; without them the git test is reported as skipped (UNAVAILABLE).
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ClassificationService } from "../../engine/classification-service";

const BASE = "3111fd7";
const REPO = join(import.meta.dir, "../../../../..");
const DIR = "packages/classification/src";

export const LEGACY_FILES = [
  ...[
    "classifiers/bridge-classifier.ts",
    "classifiers/privacy-cash-classifier.ts",
    "classifiers/airdrop-classifier.ts",
    "classifiers/nft-mint-classifier.ts",
    "classifiers/nft-transfer-classifier.ts",
    "classifiers/stake-deposit-classifier.ts",
    "classifiers/stake-withdraw-classifier.ts",
    "classifiers/solana-pay-classifier.ts",
    "classifiers/fee-only-classifier.ts",
    "classifiers/transfer-classifier.ts",
    "classifiers/swap-classifier.ts",
    "engine/transfer-pairing.ts",
    "engine/leg-helpers.ts",
    "protocols/detector.ts",
  ].map((f) => `${DIR}/${f}`),
  // the mapper that builds `legs` (v1-main) and the list filter
  "packages/solana/src/mappers/balance-parser.ts",
  "packages/solana/src/mappers/transaction-to-legs.ts",
  "packages/domain/src/tx/spam-filter.ts",
];

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}
const available = git(["cat-file", "-e", `${BASE}^{commit}`]) !== null;
if (!available) console.warn(`legacy source identity: UNAVAILABLE (git or ${BASE} missing)`);

describe(`legacy classifiers are ${BASE} byte-for-byte`, () => {
  test.skipIf(!available)(`git diff ${BASE} -- the classifiers, helpers, detector, legs mapper and spam filter is empty`, () => {
    expect(git(["diff", BASE, "--", ...LEGACY_FILES])).toBe("");
  });

  test("every registered classifier reads v1-main", () => {
    const migrated = (new ClassificationService() as unknown as { classifiers: Array<{ classifier: { name: string; inputVersion?: string } }> }).classifiers
      .filter(({ classifier }) => (classifier.inputVersion ?? "v1-main") !== "v1-main")
      .map(({ classifier }) => classifier.name);
    expect(migrated).toEqual([]);
  });
});

/**
 * Source fidelity of the frozen "v1-main" input: each file in this directory must be the
 * 3111fd7 file verbatim, apart from the compatibility header and relative import paths,
 * and the modules it loads at runtime must be unchanged since 3111fd7.
 *
 * Needs git and commit 3111fd7. Without them the tests are reported as skipped
 * (UNAVAILABLE), never as passed. Behavioural fidelity (ordered leg arrays) is proven
 * separately by packages/sdk/src/legacy-input.test.ts against a generated oracle.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "3111fd7";
const REPO = join(import.meta.dir, "../../../../..");

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

const available = git(["cat-file", "-e", `${BASE}^{commit}`]) !== null;
if (!available) console.warn(`legacy-v1-main fidelity: UNAVAILABLE (git or commit ${BASE} missing)`);

/** The vendored text with the header removed and import paths mapped back to the original location. */
function original(file: string): string {
  const text = readFileSync(join(import.meta.dir, file), "utf8");
  const headerEnd = text.indexOf(" */\n") + " */\n".length;
  expect(text.slice(0, headerEnd)).toContain(`FROZEN AT ${BASE}`);
  return text.slice(headerEnd).replaceAll('from "../../constants/', 'from "../constants/');
}

describe(`legacy-v1-main is ${BASE} verbatim`, () => {
  for (const file of ["balance-parser.ts", "transaction-to-legs.ts"]) {
    test.skipIf(!available)(`${file} equals git show ${BASE}:packages/solana/src/mappers/${file}`, () => {
      const base = git(["show", `${BASE}:packages/solana/src/mappers/${file}`]);
      expect(base).not.toBeNull();
      expect(original(file)).toBe(base!);
    });
  }

  test.skipIf(!available)("modules the frozen files load at runtime are unchanged since the base", () => {
    // Runtime imports: token-registry (money), account-id (tx), protocol-constants (solana).
    const changed = git([
      "diff",
      "--name-only",
      BASE,
      "--",
      "packages/domain/src/money",
      "packages/domain/src/tx/account-id.ts",
      "packages/solana/src/constants",
    ]);
    expect(changed).toBe("");
  });
});

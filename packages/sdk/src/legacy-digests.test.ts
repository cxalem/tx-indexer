/**
 * Git-independent protection of the legacy ("v1-main") classification path: every source
 * file it loads at runtime must hash to the digest recorded in
 * __tests__/legacy-input/legacy-digests.3111fd7.json (generated, and verified against
 * `git show 3111fd7`, by generate-digests.ts). Fails on any mismatch, any missing file and
 * any new runtime import, with or without git. To change a legacy file on purpose, see the
 * header of generate-digests.ts (an accuracy/CHANGES.md entry is required in the same commit).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { closure, sha256 } from "./__tests__/legacy-input/generate-digests";

const REPO = join(import.meta.dir, "../../..");
const recorded = JSON.parse(
  readFileSync(join(import.meta.dir, "__tests__/legacy-input/legacy-digests.3111fd7.json"), "utf8"),
) as { base: string; changedFromBase: string[]; files: Record<string, string> };

describe("legacy path source digests (3111fd7)", () => {
  test("no file is recorded as changed from the base", () => {
    expect(recorded.base).toBe("3111fd7");
    expect(recorded.changedFromBase).toEqual([]);
  });

  test("the runtime import closure is exactly the recorded file set", () => {
    expect(closure()).toEqual(Object.keys(recorded.files).sort());
  });

  for (const [file, digest] of Object.entries(recorded.files)) {
    test(file, () => {
      expect(existsSync(join(REPO, file))).toBe(true);
      expect(sha256(file)).toBe(digest);
    });
  }
});

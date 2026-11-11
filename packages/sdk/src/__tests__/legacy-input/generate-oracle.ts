/**
 * Generates oracle.3111fd7.json: for every corpus item and perspective, the ORDERED legs,
 * all eleven classifiers' outputs and the final classification, as the 3111fd7 tree
 * produces them. The test then requires this tree's "v1-main" legs and legacy classifier
 * outputs to be identical.
 *
 *   git archive 3111fd7 | tar -x -C <dir> && (cd <dir> && bun install --ignore-scripts)
 *   bun packages/sdk/src/__tests__/legacy-input/generate-oracle.ts <dir>
 *
 * <dir> must be a checkout of exactly 3111fd7 with dependencies installed.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { corpus } from "./corpus";
import { loadTree, runItem, type OracleEntry } from "./runner";

const base = process.argv[2];
if (!base) throw new Error("usage: bun generate-oracle.ts <path to a 3111fd7 checkout>");

// Never reach the network.
globalThis.fetch = (async () => {
  throw new Error("oracle: network access is not allowed");
}) as unknown as typeof fetch;

const tree = await loadTree(base);
const entries: OracleEntry[] = [];
for (const item of corpus()) {
  for (const perspective of item.perspectives) {
    entries.push(await runItem(tree, item, perspective, "base"));
  }
}
const out = join(import.meta.dir, "oracle.3111fd7.json");
writeFileSync(out, JSON.stringify({ base: "3111fd7", entries }) + "\n");
console.log(`${entries.length} entries (${entries.filter((e) => e.error).length} errors) -> ${out}`);

/**
 * Generates sdk-boundary.3111fd7.json by running the BOUNDARY_IDS entries through the SDK
 * methods of a 3111fd7 checkout (see sdk-boundary.ts).
 *
 *   bun packages/sdk/src/__tests__/legacy-input/generate-sdk-boundary.ts <3111fd7 checkout>
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { corpus } from "./corpus";
import { BOUNDARY_IDS, runBoundary } from "./sdk-boundary";

const base = process.argv[2];
if (!base) throw new Error("usage: bun generate-sdk-boundary.ts <path to a 3111fd7 checkout>");
globalThis.fetch = (async () => {
  throw new Error("sdk boundary: network access is not allowed");
}) as unknown as typeof fetch;
const results = [];
for (const item of corpus().filter((i) => BOUNDARY_IDS.includes(i.id))) {
  for (const p of item.perspectives) if (p) results.push(await runBoundary(base, item, p));
}
const out = join(import.meta.dir, "sdk-boundary.3111fd7.json");
writeFileSync(out, JSON.stringify({ base: "3111fd7", results }, null, 1) + "\n");
console.log(`${results.length} perspectives -> ${out}`);

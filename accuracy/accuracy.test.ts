/**
 * Accuracy set: schema validation, offline replay, scoring and the regression gate.
 *
 *   bun run accuracy            # score + gate against accuracy/baseline.json
 *   bun run accuracy:baseline   # accept the current scores: rewrites baseline.json and BASELINE.md
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCURACY_DIR,
  aggregate,
  compareToBaseline,
  createStrictRpc,
  loadCases,
  renderReport,
  runAll,
  type Baseline,
} from "./src/scorer";
import { createIndexer } from "../packages/sdk/src/client";

const WRITE = process.env.ACCURACY_WRITE_BASELINE === "1";
const BASELINE_JSON = join(ACCURACY_DIR, "baseline.json");
const BASELINE_MD = join(ACCURACY_DIR, "BASELINE.md");
const sdkVersion = JSON.parse(readFileSync(join(ACCURACY_DIR, "../packages/sdk/package.json"), "utf8")).version;

const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async () => {
    throw new Error("accuracy: network access is not allowed");
  }) as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

function markdown(report: string): string {
  return [
    "# Accuracy baseline",
    "",
    "Generated file: do not edit by hand. It records what today's SDK gets right and wrong on the",
    "hand-labelled cases in `accuracy/cases/`. See `accuracy/README.md` for the format and the rules.",
    "",
    "Regenerate (from the repo root) after a reviewed change to the SDK or to the cases:",
    "",
    "```sh",
    "bun run accuracy:baseline   # rewrites accuracy/baseline.json and accuracy/BASELINE.md",
    "bun run accuracy            # gate: fails on any regression versus baseline.json",
    "```",
    "",
    "```text",
    report.trimEnd(),
    "```",
    "",
  ].join("\n");
}

describe("accuracy set", () => {
  const cases = loadCases();

  test("every case validates against the schema and its own rpc.json", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  test("replay is offline: unknown signatures and other methods throw", async () => {
    const { rpc } = createStrictRpc(new Map());
    const indexer = createIndexer({ client: { rpc: rpc as never } });
    await expect(
      indexer.getTransaction(cases[0]!.case.signature, { enrichNftMetadata: false, enrichTokenMetadata: false }),
    ).rejects.toThrow();
    await expect(indexer.getBalance(cases[0]!.case.perspectives[0]!.address)).rejects.toThrow();
  });

  test("the gate catches each kind of regression", () => {
    const base = JSON.parse(readFileSync(BASELINE_JSON, "utf8")) as Baseline;
    const worse = structuredClone(base);
    const passing = Object.keys(base.caseResults).find((id) => base.caseResults[id]!.pass);
    if (passing) worse.caseResults[passing]!.pass = false;
    worse.forbiddenViolations = [...worse.forbiddenViolations, "synthetic @x: swap"];
    const kind = Object.keys(base.perKind).find((k) => (base.perKind[k]!.recall ?? 0) > 0)!;
    worse.perKind[kind]!.recall = 0;
    const found = compareToBaseline(base, worse);
    if (passing) expect(found.some((f) => f.includes(passing))).toBe(true);
    expect(found.some((f) => f.includes("synthetic"))).toBe(true);
    expect(found.some((f) => f.startsWith(`${kind} recall dropped`))).toBe(true);
    expect(compareToBaseline(base, base)).toEqual([]);
  });

  test("score, report, and regression gate", async () => {
    const results = await runAll(cases);
    const again = await runAll(cases);
    const current = aggregate(results, sdkVersion);
    expect(aggregate(again, sdkVersion)).toEqual(current); // deterministic

    const report = renderReport(current, results);
    console.log("\n" + report);

    if (WRITE || !existsSync(BASELINE_JSON)) {
      writeFileSync(BASELINE_JSON, JSON.stringify(current, null, 2) + "\n");
      writeFileSync(BASELINE_MD, markdown(report));
      if (!WRITE) throw new Error("accuracy/baseline.json was missing and has been written; review and commit it");
      return;
    }
    const base = JSON.parse(readFileSync(BASELINE_JSON, "utf8")) as Baseline;
    const regressions = compareToBaseline(base, current);
    if (regressions.length) {
      console.log("REGRESSIONS versus accuracy/baseline.json:\n  " + regressions.join("\n  "));
    }
    expect(regressions).toEqual([]);
    if (JSON.stringify(base) !== JSON.stringify(current)) {
      console.log(
        "Scores differ from the baseline without regressing. If this is an improvement, accept it with `bun run accuracy:baseline` in the same commit.",
      );
    }
  }, 60_000);
});

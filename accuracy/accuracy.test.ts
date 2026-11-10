/**
 * Accuracy set: schema validation, offline replay, scoring and the regression gate.
 *
 *   bun run accuracy            # type-check the scorer, then score + gate against accuracy/baseline.json
 *   bun run accuracy:baseline   # accept the current scores: rewrites baseline.json and BASELINE.md
 *                               # (add a line to accuracy/CHANGES.md in the same commit)
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
  predictAll,
  renderReport,
  scoreCase,
  type Baseline,
  type CaseResult,
  type LoadedCase,
  type Prediction,
} from "./src/scorer";
import { createIndexer } from "../packages/sdk/src/client";

const WRITE = process.env.ACCURACY_WRITE_BASELINE === "1";
const BASELINE_JSON = join(ACCURACY_DIR, "baseline.json");
const BASELINE_MD = join(ACCURACY_DIR, "BASELINE.md");
const REPO = join(ACCURACY_DIR, "..");
const sdkVersion = JSON.parse(readFileSync(join(REPO, "packages/sdk/package.json"), "utf8")).version;

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
    "Generated file: do not edit by hand. It records what the SDK version named below gets right and wrong on",
    "the hand-labelled cases in `accuracy/cases/`. See `accuracy/README.md` for the format and the rules, and",
    "`accuracy/CHANGES.md` for why the baseline last changed.",
    "",
    "Regenerate (from the repo root) after a reviewed change to the SDK or to the cases:",
    "",
    "```sh",
    "bun run accuracy:baseline   # rewrites accuracy/baseline.json and accuracy/BASELINE.md",
    "bun run accuracy            # gate: fails on any regression versus baseline.json",
    "```",
    "",
    "Every regeneration needs a dated line in `accuracy/CHANGES.md` in the same commit.",
    "",
    "```text",
    report.trimEnd(),
    "```",
    "",
  ].join("\n");
}

function git(args: string[]): { ok: boolean; out: string } {
  try {
    const r = Bun.spawnSync(["git", ...args], { cwd: REPO, stdout: "pipe", stderr: "pipe" });
    return { ok: r.exitCode === 0, out: r.stdout.toString() };
  } catch {
    return { ok: false, out: "" };
  }
}

const cases = loadCases();
let preds: Map<string, Prediction[]>;
let results: CaseResult[];
let current: Baseline;

function rescore(mutate: (id: string, p: Prediction[]) => Prediction[]): Baseline {
  const rs = cases.map((lc) => scoreCase(lc, mutate(lc.case.id, structuredClone(preds.get(lc.case.id)!))));
  return aggregate(rs, sdkVersion);
}

describe("accuracy set", () => {
  beforeAll(async () => {
    preds = await predictAll(cases);
    results = cases.map((lc) => scoreCase(lc, preds.get(lc.case.id)!));
    current = aggregate(results, sdkVersion);
  });

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

  test("scoring is deterministic", async () => {
    const again = await predictAll(cases);
    expect(aggregate(cases.map((lc) => scoreCase(lc, again.get(lc.case.id)!)), sdkVersion)).toEqual(current);
  });

  test("score, report, and regression gate", () => {
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
    if (regressions.length) console.log("REGRESSIONS versus accuracy/baseline.json:\n  " + regressions.join("\n  "));
    expect(regressions).toEqual([]);
    if (JSON.stringify(base) !== JSON.stringify(current)) {
      console.log("Scores differ from the baseline without regressing. Accept with `bun run accuracy:baseline` plus a CHANGES.md line.");
    }
  });

  test("a baseline change comes with a CHANGES.md line", () => {
    const inRepo = git(["rev-parse", "--is-inside-work-tree"]);
    if (!inRepo.ok) {
      console.log("not a git checkout: CHANGES.md check skipped");
      return;
    }
    const dirty = (p: string) => git(["status", "--porcelain", "--", p]).out.trim() !== "";
    if (dirty("accuracy/baseline.json")) {
      expect({ baselineChanged: true, changesLogged: dirty("accuracy/CHANGES.md") }).toEqual({
        baselineChanged: true,
        changesLogged: true,
      });
    }
    // Committed state: the last commit that touched baseline.json must also touch CHANGES.md.
    // (Skipped while baseline.json has uncommitted changes: the working-tree rule above applies.)
    const last = dirty("accuracy/baseline.json") ? "" : git(["log", "-1", "--format=%H", "--", "accuracy/baseline.json"]).out.trim();
    if (last) {
      const files = git(["show", "--name-only", "--format=", last]).out.split("\n");
      expect({ commit: last, touchesChanges: files.includes("accuracy/CHANGES.md") }).toEqual({ commit: last, touchesChanges: true });
    }
  });
});

describe("regression gate (synthetic predictions)", () => {
  const find = (id: string): LoadedCase => cases.find((c) => c.case.id === id)!;

  test("unchanged predictions pass", () => {
    expect(compareToBaseline(current, rescore((_, p) => p))).toEqual([]);
  });

  test("a failed transaction now labelled `reward` instead of `other` fails the gate", () => {
    const id = "execution-failed-jupiter-swap";
    expect(find(id)).toBeDefined();
    expect(current.caseResults[id]!.perspectives[find(id).case.perspectives[0]!.address]!.outcome).toBe("abstained");
    const worse = rescore((cid, p) => (cid === id ? p.map((x) => ({ ...x, kind: "reward" })) : p));
    const found = compareToBaseline(current, worse);
    expect(found.some((f) => f.includes(id) && f.includes("new wrong label reward"))).toBe(true);
    expect(found.some((f) => f.startsWith("reward precision n/a"))).toBe(true);
  });

  test("a wrong label that changes kind is a new wrong label", () => {
    const [id, addr] = Object.entries(current.caseResults)
      .flatMap(([cid, c]) => Object.entries(c.perspectives).map(([a, p]) => [cid, a, p] as const))
      .find(([, , p]) => p.outcome === "wrong_label" && p.predictedKind === "transfer")!;
    const worse = rescore((cid, p) => (cid === id ? p.map((x) => (x.address === addr ? { ...x, kind: "airdrop" } : x)) : p));
    expect(compareToBaseline(current, worse).some((f) => f.includes(`${id} @${addr}: new wrong label airdrop`))).toBe(true);
  });

  test("a correct perspective becoming an abstention fails the gate", () => {
    const id = "transfer-usdc-plain";
    const worse = rescore((cid, p) => (cid === id ? p.map((x) => ({ ...x, kind: "other" })) : p));
    const found = compareToBaseline(current, worse);
    expect(found.some((f) => f.includes(id) && f.includes("was correct, now abstained"))).toBe(true);
    expect(found.some((f) => f.startsWith("transfer recall dropped"))).toBe(true);
  });

  test("an exact amount that becomes wrong fails, also inside a case that already fails", () => {
    const hit = Object.entries(current.caseResults)
      .filter(([, c]) => !c.pass)
      .flatMap(([cid, c]) => Object.entries(c.perspectives).map(([a, p]) => [cid, a, p] as const))
      .find(([cid, a, p]) => p.amountsExact === true && preds.get(cid)!.find((x) => x.address === a)!.amounts.length > 0);
    expect(hit).toBeDefined();
    const [id, addr] = hit!;
    const worse = rescore((cid, p) =>
      cid === id
        ? p.map((x) =>
            x.address === addr ? { ...x, amounts: x.amounts.map((m) => ({ ...m, amountRaw: String(BigInt(m.amountRaw) + 1n) })) } : x,
          )
        : p,
    );
    expect(compareToBaseline(current, worse).some((f) => f === `${id} @${addr}: amounts were exact, now wrong`)).toBe(true);
  });

  test("fee and execution regressions fail the gate", () => {
    const id = cases[0]!.case.id;
    const worse = rescore((cid, p) => (cid === id ? p.map((x) => ({ ...x, feeLamports: "1", execution: "failed" as const })) : p));
    const found = compareToBaseline(current, worse);
    if (current.caseResults[id]!.feeAgrees) expect(found).toContain(`case ${id}: fee was right and is now wrong`);
    if (current.caseResults[id]!.executionAgrees) expect(found).toContain(`case ${id}: execution status was right and is now wrong`);
  });

  test("corpus changes fail the gate until the baseline is regenerated", () => {
    const id = cases[1]!.case.id;
    const changed = structuredClone(current);
    changed.caseResults[id]!.hash = "0".repeat(64);
    expect(compareToBaseline(current, changed)).toContain(
      `case ${id}: case.json, rpc.json or expected.json changed since the baseline`,
    );
    const removed = structuredClone(current);
    delete removed.caseResults[id];
    expect(compareToBaseline(current, removed)).toContain(`case ${id} is in the baseline but was not scored (removed?)`);
    const lessPerspectives = structuredClone(current);
    const addr = Object.keys(lessPerspectives.caseResults[id]!.perspectives)[0]!;
    delete lessPerspectives.caseResults[id]!.perspectives[addr];
    expect(compareToBaseline(current, lessPerspectives)).toContain(`${id} @${addr}: perspective removed`);
  });

  test("per-kind ratios are compared on raw counts, including n/a transitions", () => {
    const b = structuredClone(current);
    const n = structuredClone(current);
    b.perKind.synthetic = { tp: 2, fp: 1, fn: 0, precision: 0.6667, recall: 1 };
    n.perKind.synthetic = { tp: 199999, fp: 100000, fn: 0, precision: 0.6667, recall: 1 };
    expect(compareToBaseline(b, n).some((f) => f.startsWith("synthetic precision dropped"))).toBe(true);
    n.perKind.synthetic = { tp: 0, fp: 0, fn: 0, precision: null, recall: null };
    const found = compareToBaseline(b, n);
    expect(found.some((f) => f.includes("synthetic precision 2/3 -> n/a"))).toBe(true);
    expect(found.some((f) => f.includes("synthetic recall 2/2 -> n/a"))).toBe(true);
  });
});

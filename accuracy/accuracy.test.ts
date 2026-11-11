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
  amountsMatch,
  compareToBaseline,
  componentExactness,
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

function git(args: string[]): { ok: boolean; out: string; err: string } {
  try {
    const r = Bun.spawnSync(["git", ...args], { cwd: REPO, stdout: "pipe", stderr: "pipe" });
    return { ok: r.exitCode === 0, out: r.stdout.toString(), err: r.stderr.toString().trim() };
  } catch (e) {
    return { ok: false, out: "", err: (e as Error).message };
  }
}

/** Runs git and throws (failing the test) on a non-zero exit: a git failure is never a pass. */
function gitOrThrow(args: string[]): string {
  const r = git(args);
  if (!r.ok) throw new Error(`git ${args.join(" ")} failed: ${r.err || "no output"}`);
  return r.out;
}

/**
 * What the CHANGES.md co-change reminder can verify here. Decided once, before the tests run,
 * so an unverifiable check shows up as a visible skip with the reason, never as a pass.
 */
function changesCheckAvailability(): { workingTree: string | null; history: string | null; lastBaselineCommit: string } {
  const inside = git(["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok || inside.out.trim() !== "true") {
    const why = `UNAVAILABLE: not a git checkout or git not usable (${inside.err || "no output"})`;
    return { workingTree: why, history: why, lastBaselineCommit: "" };
  }
  const shallow = git(["rev-parse", "--is-shallow-repository"]);
  if (!shallow.ok) return { workingTree: null, history: `UNAVAILABLE: cannot tell whether the clone is shallow (${shallow.err})`, lastBaselineCommit: "" };
  if (shallow.out.trim() === "true") return { workingTree: null, history: "UNAVAILABLE: shallow clone, history incomplete", lastBaselineCommit: "" };
  const log = git(["log", "-1", "--format=%H", "--", "accuracy/baseline.json"]);
  if (!log.ok) return { workingTree: null, history: `UNAVAILABLE: git log failed (${log.err})`, lastBaselineCommit: "" };
  const last = log.out.trim();
  if (!last) return { workingTree: null, history: "UNAVAILABLE: no commit touches accuracy/baseline.json yet", lastBaselineCommit: "" };
  const parents = git(["rev-list", "--parents", "-n", "1", last]);
  if (!parents.ok) return { workingTree: null, history: `UNAVAILABLE: git rev-list failed (${parents.err})`, lastBaselineCommit: "" };
  if (parents.out.trim().split(/\s+/).length < 2) {
    return { workingTree: null, history: `UNAVAILABLE: ${last.slice(0, 12)} has no parent, so its changes cannot be told apart`, lastBaselineCommit: "" };
  }
  return { workingTree: null, history: null, lastBaselineCommit: last };
}
const changesCheck = changesCheckAvailability();
for (const why of new Set([changesCheck.workingTree, changesCheck.history])) {
  if (why) console.log(`CHANGES.md co-change check ${why}`);
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

  // Co-change reminder only: it checks that CHANGES.md changed alongside baseline.json, not what
  // the entry says (a trivial CHANGES.md edit satisfies it). It is not review enforcement.
  test.skipIf(changesCheck.workingTree !== null)(
    `working tree: an uncommitted baseline.json change comes with a CHANGES.md change${changesCheck.workingTree ? ` [${changesCheck.workingTree}]` : ""}`,
    () => {
      const dirty = (p: string) => gitOrThrow(["status", "--porcelain", "--", p]).trim() !== "";
      if (dirty("accuracy/baseline.json")) {
        expect({ baselineChanged: true, changesLogged: dirty("accuracy/CHANGES.md") }).toEqual({
          baselineChanged: true,
          changesLogged: true,
        });
      }
    },
  );

  test.skipIf(changesCheck.history !== null)(
    `history: the last commit that touched baseline.json also touched CHANGES.md${changesCheck.history ? ` [${changesCheck.history}]` : ""}`,
    () => {
      const last = changesCheck.lastBaselineCommit;
      // Compared with the first parent, so a merge commit is read correctly too.
      const files = gitOrThrow(["diff", "--name-only", `${last}^1`, last]).split("\n");
      expect(files).toContain("accuracy/baseline.json");
      expect({ commit: last, touchesChanges: files.includes("accuracy/CHANGES.md") }).toEqual({ commit: last, touchesChanges: true });
    },
  );
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

  const outcomeTotal = (b: Baseline) =>
    b.overall.primaryCorrect +
    b.overall.kindOnly +
    b.overall.secondaryHits +
    b.overall.disputedAlternatives +
    b.overall.abstentions +
    b.overall.wrongLabels +
    b.overall.errors;
  const outcomeOf = (b: Baseline, id: string, addr: string) => b.caseResults[id]!.perspectives[addr]!;

  test("P1-a escape 1: a reported kind with empty amounts and null participants is a wrong label, not a disputed alternative", () => {
    const id = "nft-sale-buyback-for-usdc";
    const addr = "miDtj3vgdxVykHzRyFwyG8MXpvK8eQqamSLVdBr7WPt";
    expect(find(id).expected.disputed).toBe(true);
    const malformed = rescore((cid, p) =>
      cid === id ? p.map((x) => (x.address === addr ? { ...x, kind: "nft_purchase", amounts: [], sender: null, receiver: null } : x)) : p,
    );
    expect(outcomeOf(malformed, id, addr).outcome).toBe("wrong_label");
    expect(malformed.overall.disputedAlternatives).toBe(current.overall.disputedAlternatives);
    expect(malformed.perKind.nft_purchase!.fp).toBe((current.perKind.nft_purchase?.fp ?? 0) + 1);
    expect(compareToBaseline(current, malformed).some((f) => f.includes(`${id} @${addr}: new wrong label nft_purchase`))).toBe(true);
    // Control: the complete reported expectation is a disputed alternative, and not a false positive.
    const complete = rescore((cid, p) =>
      cid === id
        ? p.map((x) =>
            x.address === addr
              ? {
                  ...x,
                  kind: "nft_purchase",
                  sender: "BTq5uRfTEAjKTwKkqDzSAXLAUstMX3kT2v6SzGBZs1th",
                  receiver: addr,
                  amounts: [{ mint: "GMghqvQrtSxdSnnD2cWcM44DGu55zuWHw95cUJv3oP1u", amountRaw: "1", decimals: 0, direction: "in" as const }],
                }
              : x,
          )
        : p,
    );
    expect(outcomeOf(complete, id, addr).outcome).toBe("disputed_alternative");
    expect(complete.perKind.nft_purchase?.fp ?? 0).toBe(current.perKind.nft_purchase?.fp ?? 0);
  });

  test("P1-a escape 2: an exact match of the DCA two-leg reported swap is a disputed alternative, not a mandatory swap", () => {
    const id = "dca-fill-executed-by-keeper";
    const addr = "5wQULuzRkYe4KAttSD1L1fuxavjepcMn1PycNMmPchna";
    const twoLeg = rescore((cid, p) =>
      cid === id
        ? p.map((x) =>
            x.address === addr
              ? {
                  ...x,
                  kind: "swap",
                  sender: null,
                  receiver: null,
                  amounts: [
                    { mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", amountRaw: "1310000000", decimals: 9, direction: "out" as const },
                    { mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", amountRaw: "428513360884", decimals: 9, direction: "in" as const },
                  ],
                }
              : x,
          )
        : p,
    );
    const r = outcomeOf(twoLeg, id, addr);
    expect(r.outcome).toBe("disputed_alternative");
    expect(r.pass).toBe(false);
    expect(twoLeg.overall.primaryCorrect).toBe(current.overall.primaryCorrect);
    expect(twoLeg.perKind.swap!.tp).toBe(current.perKind.swap!.tp);
    expect(twoLeg.overall.disputedAlternatives).toBe(current.overall.disputedAlternatives + 1);
  });

  test("P1-b: corrupting an exact secondary action is kind_only, not correct, and fails the gate", () => {
    const id = "transfer-four-tokens-one-recipient-sweep";
    const addr = find(id).case.perspectives[0]!.address;
    const before = outcomeOf(current, id, addr);
    expect(before.outcome).toBe("secondary_hit");
    expect(before.secondaryHit).toEqual({ action: "actions[2] transfer #7", kind: "transfer", amountsExact: true, participantsExact: true });
    const corrupt = rescore((cid, p) =>
      cid === id
        ? p.map((x) =>
            x.address === addr
              ? { ...x, amounts: x.amounts.map((m) => (m.amountRaw === "792000000" ? { ...m, amountRaw: "792000001" } : m)) }
              : x,
          )
        : p,
    );
    const after = outcomeOf(corrupt, id, addr);
    expect(after.outcome).toBe("kind_only");
    expect(after.pass).toBe(false);
    expect(corrupt.overall.primaryCorrect).toBe(current.overall.primaryCorrect);
    expect(corrupt.overall.secondaryHits).toBe(current.overall.secondaryHits - 1);
    expect(compareToBaseline(current, corrupt)).toContain(`${id} @${addr}: was a secondary hit (actions[2] transfer #7), now kind_only (transfer)`);
  });

  test("a correct perspective that becomes kind_only fails the gate", () => {
    const id = "transfer-usdc-plain";
    const addr = find(id).case.perspectives[0]!.address;
    expect(outcomeOf(current, id, addr).outcome).toBe("correct");
    const worse = rescore((cid, p) =>
      cid === id ? p.map((x) => (x.address === addr ? { ...x, amounts: x.amounts.map((m) => ({ ...m, amountRaw: String(BigInt(m.amountRaw) + 1n) })) } : x)) : p,
    );
    expect(outcomeOf(worse, id, addr).outcome).toBe("kind_only");
    expect(compareToBaseline(current, worse)).toContain(`${id} @${addr}: was correct, now kind_only (transfer)`);
  });

  test("a secondary hit that moves to another secondary action fails the gate", () => {
    const id = "transfer-four-tokens-one-recipient-sweep";
    const addr = find(id).case.perspectives[0]!.address;
    const moved = rescore((cid, p) =>
      cid === id
        ? p.map((x) =>
            x.address === addr
              ? { ...x, amounts: [{ mint: find(id).expected.perspectives[0]!.actions[3]!.amounts![0]!.mint, amountRaw: "1000000", decimals: find(id).expected.perspectives[0]!.actions[3]!.amounts![0]!.decimals, direction: "out" as const }] }
              : x,
          )
        : p,
    );
    expect(outcomeOf(moved, id, addr).secondaryHit?.action).toBe("actions[3] transfer #9");
    expect(compareToBaseline(current, moved)).toContain(
      `${id} @${addr}: was a secondary hit (actions[2] transfer #7), now a secondary hit on actions[3] transfer #9`,
    );
  });

  test("per component: an exact leg going wrong inside an already inexact perspective fails the gate", () => {
    // Reviewer's example: the SOL leg is already wrong, the FUSE leg is exact. Corrupting FUSE does not
    // change the per-perspective booleans (amountsExact stays false), so only the component check sees it.
    const id = "swap-v0-jupiter-sol-to-token";
    const addr = "EMgSdxvQqmaqjynWyNeEXcgpMDERxD7ntvBcUWr3PaEb";
    const fuse = "FUSE3in85PPWaA7BdRucpRyemH69nLQHdCU6NfwfWXqL";
    const sol = "So11111111111111111111111111111111111111112";
    const before = outcomeOf(current, id, addr);
    expect(before.outcome).toBe("kind_only");
    expect(before.amountsExact).toBe(false);
    expect(before.components).toEqual({ [`actions[0] amount out ${sol}`]: false, [`actions[0] amount in ${fuse}`]: true });
    const worse = rescore((cid, p) =>
      cid === id
        ? p.map((x) =>
            x.address === addr
              ? { ...x, amounts: x.amounts.map((m) => (m.amountRaw === "1994890919495" ? { ...m, amountRaw: "1994890919496" } : m)) }
              : x,
          )
        : p,
    );
    const after = outcomeOf(worse, id, addr);
    expect(after.outcome).toBe("kind_only");
    expect(after.amountsExact).toBe(false);
    expect(after.components[`actions[0] amount in ${fuse}`]).toBe(false);
    expect(compareToBaseline(current, worse)).toEqual([`${id} @${addr}: actions[0] amount in ${fuse} was exact, now wrong`]);
  });

  test("per component: an exact participant field going wrong inside an inexact perspective fails the gate", () => {
    const hit = Object.entries(current.caseResults)
      .flatMap(([cid, c]) => Object.entries(c.perspectives).map(([a, p]) => [cid, a, p] as const))
      .find(([, , p]) => p.outcome === "kind_only" && Object.entries(p.components).some(([k, v]) => k.endsWith(" sender") && v));
    expect(hit).toBeDefined();
    const [id, addr] = hit!;
    const worse = rescore((cid, p) => (cid === id ? p.map((x) => (x.address === addr ? { ...x, sender: "11111111111111111111111111111111" } : x)) : p));
    expect(compareToBaseline(current, worse).some((f) => f.startsWith(`${id} @${addr}: actions[`) && f.endsWith(" sender was exact, now wrong"))).toBe(true);
  });

  test("a secondary hit on an accepted synonym is counted in the expected action's kind, shown with the matched kind", () => {
    const id = "transfer-four-tokens-one-recipient-sweep";
    const lc = structuredClone(find(id));
    const addr = lc.case.perspectives[0]!.address;
    const action = lc.expected.perspectives[0]!.actions[2]!;
    expect(action.primary).toBe(false);
    expect(action.kind).toBe("transfer");
    action.alternatives = [
      { kind: "reward", scoring: "accepted", sender: action.sender, receiver: action.receiver, amounts: action.amounts, note: "synthetic synonym" } as never,
    ];
    const p = structuredClone(preds.get(id)!).map((x) => (x.address === addr ? { ...x, kind: "reward" } : x));
    const r = scoreCase(lc, p);
    const pr = r.perspectives.find((x) => x.address === addr)!;
    expect(pr.outcome).toBe("secondary_hit");
    expect(pr.secondaryHitKind).toBe("transfer");
    expect(pr.secondaryHit).toEqual({ action: "actions[2] transfer #7", kind: "reward", amountsExact: true, participantsExact: true });
    const b = aggregate([r], sdkVersion);
    expect(b.secondaryPerKind.reward).toBeUndefined();
    expect(b.secondaryPerKind.transfer![0]).toBe(r.perspectives.filter((x) => x.outcome === "secondary_hit").length);
    expect(b.overall.secondaryRecall[0]).toBe(b.secondaryPerKind.transfer![0]);
  });

  test("KNOWN LIMITATION: amount matching is greedy, so duplicate-mint legs with mixed direction can be misassigned", () => {
    // Expected: 5 of M out and 5 of M in. Predicted: one leg without direction (matches either), then one `out` leg.
    // A valid assignment exists (undirected -> in, out -> out), but the greedy matcher gives the first predicted leg
    // the first expected leg (out) and then finds no `out` left for the second. Documented, not fixed here:
    // a deterministic maximum matching is tracked as a follow-up.
    const M = "So11111111111111111111111111111111111111112";
    const expected = [
      { mint: M, amountRaw: "5", decimals: 9, direction: "out" as const },
      { mint: M, amountRaw: "5", decimals: 9, direction: "in" as const },
    ];
    const reordered = [
      { mint: M, amountRaw: "5", decimals: 9 },
      { mint: M, amountRaw: "5", decimals: 9, direction: "out" as const },
    ];
    expect(amountsMatch(expected as never, reordered)).toBe(false);
    // The same legs in the other order match.
    expect(amountsMatch(expected as never, [reordered[1]!, reordered[0]!])).toBe(true);
    // Component exactness follows expected-leg order and has the same greedy behaviour: the `in` leg is
    // reported inexact although the prediction could cover it.
    expect(componentExactness({ label: "actions[0]", sender: null, receiver: null, amounts: expected as never }, { sender: null, receiver: null, amounts: reordered })).toEqual({
      [`actions[0] amount out ${M}`]: true,
      [`actions[0] amount in ${M}`]: false,
    });
  });

  test("outcome classes always sum to the number of perspectives", () => {
    const variants: Baseline[] = [
      current,
      rescore((_, p) => p.map((x) => ({ ...x, kind: "other" }))),
      rescore((_, p) => p.map((x) => ({ ...x, kind: "transfer" }))),
      rescore((_, p) => p.map((x) => ({ ...x, amounts: [] }))),
      rescore((_, p) => p.map((x) => ({ ...x, error: "synthetic" }))),
    ];
    for (const b of variants) {
      expect(outcomeTotal(b)).toBe(b.perspectives);
      expect(b.overall.primaryKindRight).toBe(b.overall.primaryCorrect + b.overall.kindOnly);
      const kinds = Object.values(b.perKind);
      expect(kinds.reduce((s, k) => s + k.tp + k.fn, 0)).toBe(b.perspectives);
      expect(kinds.reduce((s, k) => s + k.tp, 0)).toBe(b.overall.primaryKindRight);
      expect(kinds.reduce((s, k) => s + k.fp, 0)).toBe(b.overall.wrongLabels);
      const perPerspective = Object.values(b.caseResults).flatMap((c) => Object.values(c.perspectives));
      expect(perPerspective.length).toBe(b.perspectives);
      // a passing perspective is always a complete primary match
      expect(perPerspective.every((p) => !p.pass || p.outcome === "correct")).toBe(true);
    }
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

/**
 * Offline, deterministic accuracy scorer.
 *
 * Replays each case's recorded getTransaction response through the SDK's
 * public path (createIndexer -> getTransaction, enrichment off) once per
 * perspective, maps today's single classification to one predicted action,
 * and scores it against the hand-written expected.json.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createSolanaRpcFromTransport } from "@solana/kit";
import { parseJsonWithBigInts } from "@tx-indexer/solana/__fixtures__/fixture-rpc";
import { createIndexer } from "../../packages/sdk/src/client";
import {
  CaseSchema,
  ExpectedSchema,
  validateCase,
  type CaseJson,
  type ExpectedAction,
  type ExpectedJson,
} from "./schema";

export const ACCURACY_DIR = join(import.meta.dir, "..");
export const CASES_DIR = join(ACCURACY_DIR, "cases");

export interface LoadedCase {
  dir: string;
  case: CaseJson;
  expected: ExpectedJson;
  rpcText: string;
}

/** Loads and validates every case. Throws with every problem listed if any case is invalid. */
export function loadCases(casesDir = CASES_DIR): LoadedCase[] {
  const out: LoadedCase[] = [];
  const problems: string[] = [];
  for (const dir of readdirSync(casesDir).sort()) {
    const base = join(casesDir, dir);
    let rpcText: string;
    let caseRaw: unknown;
    let expectedRaw: unknown;
    try {
      rpcText = readFileSync(join(base, "rpc.json"), "utf8");
      caseRaw = JSON.parse(readFileSync(join(base, "case.json"), "utf8"));
      expectedRaw = JSON.parse(readFileSync(join(base, "expected.json"), "utf8"));
    } catch (e) {
      problems.push(`${dir}: cannot read case files (${(e as Error).message})`);
      continue;
    }
    const c = CaseSchema.safeParse(caseRaw);
    const x = ExpectedSchema.safeParse(expectedRaw);
    if (!c.success) problems.push(`${dir}/case.json: ${c.error.message}`);
    if (!x.success) problems.push(`${dir}/expected.json: ${x.error.message}`);
    if (!c.success || !x.success) continue;
    problems.push(...validateCase(dir, c.data, x.data, rpcText));
    out.push({ dir, case: c.data, expected: x.data, rpcText });
  }
  if (problems.length) throw new Error(`invalid accuracy cases:\n${problems.join("\n")}`);
  return out;
}

/**
 * Strict replay transport: answers getTransaction only for the recorded
 * signatures, with the verbatim body. Anything else throws.
 */
export function createStrictRpc(bodiesBySignature: Map<string, string>) {
  const calls: string[] = [];
  const transport = async ({ payload }: { payload: unknown }) => {
    const { id, method, params } = payload as { id: unknown; method: string; params: unknown[] };
    calls.push(method);
    if (method !== "getTransaction") throw new Error(`accuracy replay: unexpected RPC method ${method}`);
    const sig = String(params[0]);
    const body = bodiesBySignature.get(sig);
    if (body === undefined) throw new Error(`accuracy replay: no recorded response for ${sig}`);
    return { ...(parseJsonWithBigInts(body) as Record<string, unknown>), id } as never;
  };
  return { rpc: createSolanaRpcFromTransport(transport as never), calls };
}

export interface PredictedAmount {
  mint: string;
  amountRaw: string;
}

export interface Prediction {
  address: string;
  kind: string;
  sender: string | null;
  receiver: string | null;
  amounts: PredictedAmount[];
  feeLamports: string | null;
  execution: "succeeded" | "failed";
  reconciliation: string;
  /** console.error/warn lines the SDK printed while handling this perspective. */
  logs: string[];
  error?: string;
}

/** Replays one case for every perspective. */
export async function predictCase(lc: LoadedCase): Promise<Prediction[]> {
  const { rpc } = createStrictRpc(new Map([[lc.case.signature, lc.rpcText]]));
  const indexer = createIndexer({ client: { rpc: rpc as never } });
  const out: Prediction[] = [];
  for (const p of lc.case.perspectives) {
    const logs: string[] = [];
    const saved = { error: console.error, warn: console.warn };
    const capture = (...args: unknown[]) => {
      const first = args[0];
      const rest = args[1] as { name?: string; message?: string } | undefined;
      logs.push(`${String(first)}${rest && typeof rest === "object" ? ` ${rest.name ?? ""}: ${rest.message ?? ""}` : ""}`.trim());
    };
    console.error = capture;
    console.warn = capture;
    try {
      const res = await indexer.getTransaction(lc.case.signature, {
        enrichNftMetadata: false,
        enrichTokenMetadata: false,
        walletAddress: p.address,
      });
      if (!res) throw new Error("getTransaction returned null");
      const c = res.classification;
      const amounts: PredictedAmount[] = [];
      for (const m of [c.primaryAmount, c.secondaryAmount]) {
        if (m) amounts.push({ mint: m.token.mint, amountRaw: m.amountRaw });
      }
      out.push({
        address: p.address,
        kind: c.primaryType,
        sender: c.sender ?? null,
        receiver: c.receiver ?? null,
        amounts,
        feeLamports: res.legs.find((l) => l.role === "fee")?.amount.amountRaw ?? null,
        execution: res.tx.err === null || res.tx.err === undefined ? "succeeded" : "failed",
        reconciliation: res.tx.reconciliation?.status ?? "absent",
        logs,
      });
    } catch (e) {
      out.push({
        address: p.address,
        kind: "<error>",
        sender: null,
        receiver: null,
        amounts: [],
        feeLamports: null,
        execution: "succeeded",
        reconciliation: "error",
        logs,
        error: (e as Error).message,
      });
    } finally {
      console.error = saved.error;
      console.warn = saved.warn;
    }
  }
  return out;
}

export type Outcome = "correct" | "abstained" | "secondary_hit" | "wrong_label" | "error";

export interface PerspectiveResult {
  address: string;
  expectedKind: string;
  acceptedKinds: string[];
  predictedKind: string;
  outcome: Outcome;
  forbiddenViolation: boolean;
  amountsExact: boolean | null;
  participantsExact: boolean | null;
  pass: boolean;
  detail: string[];
}

export interface CaseResult {
  id: string;
  categories: string[];
  disputed: boolean;
  feeAgrees: boolean;
  executionAgrees: boolean;
  reconciliation: string;
  pass: boolean;
  perspectives: PerspectiveResult[];
  secondaryActionsExpected: number;
  sdkLogs: string[];
}

/**
 * `other` is the SDK saying "I don't know": predicting it is an abstention
 * (a miss, not a wrong label) whatever was expected. `fee_only` is an
 * abstention only when a real action was expected.
 */
const ABSTAIN = new Set(["other", "fee_only"]);

function amountKey(mint: string, raw: string) {
  return `${mint}:${raw}`;
}

function participantsMatch(e: ExpectedAction, p: Prediction): boolean {
  if (e.sender !== null && e.sender !== p.sender) return false;
  if (e.receiver !== null && e.receiver !== p.receiver) return false;
  return true;
}

function short(a: string | null) {
  return a ? `${a.slice(0, 4)}..${a.slice(-4)}` : "null";
}

export function scoreCase(lc: LoadedCase, preds: Prediction[]): CaseResult {
  const results: PerspectiveResult[] = [];
  let feeAgrees = true;
  let executionAgrees = true;
  let secondary = 0;
  for (const ep of lc.expected.perspectives) {
    const p = preds.find((x) => x.address === ep.address)!;
    const prim = ep.actions.find((a) => a.primary)!;
    const others = ep.actions.filter((a) => !a.primary);
    secondary += others.length;
    const accepted = [prim.kind, ...(prim.acceptableKinds ?? [])];
    const forbidden = new Set(ep.actions.flatMap((a) => a.forbidden ?? []));
    const detail: string[] = [];
    if (p.feeLamports !== lc.expected.fee) {
      feeAgrees = false;
      detail.push(`fee ${p.feeLamports} != ${lc.expected.fee}`);
    }
    if (p.execution !== lc.expected.execution) {
      executionAgrees = false;
      detail.push(`execution ${p.execution} != ${lc.expected.execution}`);
    }
    let outcome: Outcome;
    if (p.error) {
      outcome = "error";
      detail.push(`error: ${p.error}`);
    } else if (accepted.includes(p.kind) || (prim.kind === "unknown" && p.kind === "other")) {
      outcome = "correct";
    } else if (
      (p.kind === "other" && prim.kind !== "other") ||
      (p.kind === "fee_only" && !ABSTAIN.has(prim.kind))
    ) {
      outcome = "abstained";
    } else if (
      others.some((a) => [a.kind, ...(a.acceptableKinds ?? [])].includes(p.kind) && participantsMatch(a, p))
    ) {
      outcome = "secondary_hit";
    } else {
      outcome = "wrong_label";
    }
    const forbiddenViolation = forbidden.has(p.kind);
    let amountsExact: boolean | null = null;
    let participantsExact: boolean | null = null;
    if (outcome === "correct") {
      if (prim.amounts !== null) {
        const want = prim.amounts.map((m) => amountKey(m.mint, m.amountRaw)).sort();
        const got = p.amounts.map((m) => amountKey(m.mint, m.amountRaw)).sort();
        amountsExact = want.join("|") === got.join("|");
        if (!amountsExact) detail.push(`amounts got [${got.map(shortAmt).join(", ")}] want [${want.map(shortAmt).join(", ")}]`);
      }
      if (prim.sender !== null || prim.receiver !== null) {
        participantsExact = participantsMatch(prim, p);
        if (!participantsExact)
          detail.push(
            `participants got ${short(p.sender)}->${short(p.receiver)} want ${short(prim.sender)}->${short(prim.receiver)}`,
          );
      }
    }
    if (outcome !== "correct" && outcome !== "error") detail.unshift(`predicted ${p.kind}, expected ${accepted.join("|")}`);
    if (forbiddenViolation) detail.unshift(`FORBIDDEN ${p.kind}`);
    const pass = outcome === "correct" && !forbiddenViolation && amountsExact !== false && participantsExact !== false;
    results.push({
      address: ep.address,
      expectedKind: prim.kind,
      acceptedKinds: accepted,
      predictedKind: p.kind,
      outcome,
      forbiddenViolation,
      amountsExact,
      participantsExact,
      pass,
      detail,
    });
  }
  return {
    id: lc.case.id,
    categories: lc.case.categories,
    disputed: lc.expected.disputed,
    feeAgrees,
    executionAgrees,
    reconciliation: preds[0]?.reconciliation ?? "absent",
    pass: feeAgrees && executionAgrees && results.every((r) => r.pass),
    perspectives: results,
    secondaryActionsExpected: secondary,
    sdkLogs: [...new Set(preds.flatMap((p) => p.logs))].sort(),
  };
}

function shortAmt(k: string) {
  const [mint, raw] = k.split(":");
  return `${raw} ${mint!.slice(0, 4)}`;
}

export interface KindStats {
  tp: number;
  fp: number;
  fn: number;
  precision: number | null;
  recall: number | null;
}

export interface Baseline {
  schemaVersion: 1;
  sdkVersion: string;
  cases: number;
  perspectives: number;
  overall: {
    casesPassed: number;
    primaryAgreement: number;
    amountsExact: [number, number];
    participantsExact: [number, number];
    forbiddenViolations: number;
    abstentions: number;
    wrongLabels: number;
    secondaryHits: number;
    errors: number;
    feeAgreement: [number, number];
    executionAgreement: [number, number];
    secondaryActionsExpected: number;
    secondaryActionsPredicted: number;
  };
  reconciliation: Record<string, number>;
  perKind: Record<string, KindStats>;
  perCategory: Record<string, [number, number]>;
  forbiddenViolations: string[];
  caseResults: Record<string, { pass: boolean; disputed: boolean; perspectives: Record<string, string> }>;
  failing: string[];
  /** Cases during which the SDK printed console.error/warn, with the distinct messages. */
  sdkLogs: Record<string, string[]>;
}

function ratio(a: number, b: number): number | null {
  return b === 0 ? null : Math.round((a / b) * 10000) / 10000;
}

export function aggregate(results: CaseResult[], sdkVersion: string): Baseline {
  const perKind: Record<string, KindStats> = {};
  const k = (name: string) => (perKind[name] ??= { tp: 0, fp: 0, fn: 0, precision: null, recall: null });
  const rec: Record<string, number> = {};
  const perCategory: Record<string, [number, number]> = {};
  const o = {
    casesPassed: 0,
    primaryAgreement: 0,
    amountsExact: [0, 0] as [number, number],
    participantsExact: [0, 0] as [number, number],
    forbiddenViolations: 0,
    abstentions: 0,
    wrongLabels: 0,
    secondaryHits: 0,
    errors: 0,
    feeAgreement: [0, 0] as [number, number],
    executionAgreement: [0, 0] as [number, number],
    secondaryActionsExpected: 0,
    secondaryActionsPredicted: 0,
  };
  const forbiddenList: string[] = [];
  const caseResults: Baseline["caseResults"] = {};
  const failing: string[] = [];
  const sdkLogs: Record<string, string[]> = {};
  let perspectives = 0;
  for (const r of results) {
    if (r.pass) o.casesPassed++;
    rec[r.reconciliation] = (rec[r.reconciliation] ?? 0) + 1;
    o.feeAgreement[1]++;
    if (r.feeAgrees) o.feeAgreement[0]++;
    o.executionAgreement[1]++;
    if (r.executionAgrees) o.executionAgreement[0]++;
    o.secondaryActionsExpected += r.secondaryActionsExpected;
    for (const c of r.categories) {
      const t = (perCategory[c] ??= [0, 0]);
      t[1]++;
      if (r.pass) t[0]++;
    }
    const pmap: Record<string, string> = {};
    for (const p of r.perspectives) {
      perspectives++;
      pmap[p.address] = `${p.pass ? "pass" : "fail"}:${p.predictedKind}`;
      if (p.outcome === "correct") {
        o.primaryAgreement++;
        k(p.expectedKind).tp++;
      } else {
        k(p.expectedKind).fn++;
        if (p.outcome === "abstained") o.abstentions++;
        else if (p.outcome === "secondary_hit") o.secondaryHits++;
        else if (p.outcome === "error") o.errors++;
        else {
          o.wrongLabels++;
          k(p.predictedKind).fp++;
        }
      }
      if (p.amountsExact !== null) {
        o.amountsExact[1]++;
        if (p.amountsExact) o.amountsExact[0]++;
      }
      if (p.participantsExact !== null) {
        o.participantsExact[1]++;
        if (p.participantsExact) o.participantsExact[0]++;
      }
      if (p.forbiddenViolation) {
        o.forbiddenViolations++;
        forbiddenList.push(`${r.id} @${p.address}: ${p.predictedKind}`);
      }
    }
    caseResults[r.id] = { pass: r.pass, disputed: r.disputed, perspectives: pmap };
    if (!r.pass) failing.push(r.id);
    if (r.sdkLogs.length) sdkLogs[r.id] = r.sdkLogs;
  }
  for (const s of Object.values(perKind)) {
    s.precision = ratio(s.tp, s.tp + s.fp);
    s.recall = ratio(s.tp, s.tp + s.fn);
  }
  const sortObj = <T>(x: Record<string, T>) =>
    Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)));
  return {
    schemaVersion: 1,
    sdkVersion,
    cases: results.length,
    perspectives,
    overall: o,
    reconciliation: sortObj(rec),
    perKind: sortObj(perKind),
    perCategory: sortObj(perCategory),
    forbiddenViolations: forbiddenList.sort(),
    caseResults: sortObj(caseResults),
    failing: failing.sort(),
    sdkLogs: sortObj(sdkLogs),
  };
}

const pct = (v: number | null) => (v === null ? "  n/a" : `${(v * 100).toFixed(1).padStart(5)}%`);
const frac = ([a, b]: [number, number]) => `${a}/${b}${b ? ` (${((a / b) * 100).toFixed(1)}%)` : ""}`;

export function renderReport(b: Baseline, results: CaseResult[]): string {
  const L: string[] = [];
  const o = b.overall;
  L.push(`tx-indexer accuracy report (sdk ${b.sdkVersion}; ${b.cases} cases, ${b.perspectives} perspectives)`);
  L.push("");
  L.push("Overall");
  L.push(`  cases passed (every perspective right, fee + execution right) ${frac([o.casesPassed, b.cases])}`);
  L.push(`  primary kind agreement                                        ${frac([o.primaryAgreement, b.perspectives])}`);
  L.push(`  wrong labels (false positives)                                ${o.wrongLabels}`);
  L.push(`  abstentions (other/fee_only where an action was expected)     ${o.abstentions}`);
  L.push(`  predicted a secondary action instead of the primary           ${o.secondaryHits}`);
  L.push(`  forbidden-label violations                                    ${o.forbiddenViolations}`);
  L.push(`  replay errors                                                 ${o.errors}`);
  L.push(`  amounts exact (when kind right and amounts known)             ${frac(o.amountsExact)}`);
  L.push(`  participants exact (when kind right and expected non-null)    ${frac(o.participantsExact)}`);
  L.push(`  fee agreement (fee leg = meta.fee)                            ${frac(o.feeAgreement)}`);
  L.push(`  execution status agreement                                    ${frac(o.executionAgreement)}`);
  L.push(`  secondary actions expected / reported by the SDK              ${o.secondaryActionsExpected} / ${o.secondaryActionsPredicted}`);
  L.push(`  reconciliation status: ${Object.entries(b.reconciliation).map(([s, n]) => `${s} ${n}`).join(", ")}`);
  L.push("");
  L.push("Per kind (primary action, one per perspective)");
  L.push("  kind               TP  FP  FN  precision  recall");
  for (const [kind, s] of Object.entries(b.perKind)) {
    L.push(
      `  ${kind.padEnd(17)} ${String(s.tp).padStart(3)} ${String(s.fp).padStart(3)} ${String(s.fn).padStart(3)}     ${pct(s.precision)}  ${pct(s.recall)}`,
    );
  }
  L.push("");
  L.push("Per category (cases passed)");
  for (const [c, v] of Object.entries(b.perCategory)) L.push(`  ${c.padEnd(12)} ${frac(v)}`);
  L.push("");
  if (b.forbiddenViolations.length) {
    L.push("Forbidden-label violations");
    for (const f of b.forbiddenViolations) L.push(`  ${f}`);
    L.push("");
  }
  if (Object.keys(b.sdkLogs).length) {
    L.push("SDK console output during replay (not scored)");
    for (const [id, msgs] of Object.entries(b.sdkLogs)) L.push(`  ${id}: ${msgs.join(" / ")}`);
    L.push("");
  }
  L.push(`Failing cases (${b.failing.length}); [d] = disputed label`);
  for (const r of results.filter((x) => !x.pass).sort((a, b) => a.id.localeCompare(b.id))) {
    const bits = r.perspectives
      .filter((p) => !p.pass || p.detail.length)
      .map((p) => `${short(p.address)}: ${p.detail.join("; ") || "ok"}`);
    if (!r.feeAgrees) bits.push("fee mismatch");
    if (!r.executionAgrees) bits.push("execution mismatch");
    L.push(`  ${r.disputed ? "[d] " : ""}${r.id} :: ${bits.join(" | ")}`);
  }
  return L.join("\n") + "\n";
}

/** Regressions versus a committed baseline. Empty = gate passes. */
export function compareToBaseline(base: Baseline, now: Baseline): string[] {
  const out: string[] = [];
  for (const [id, r] of Object.entries(base.caseResults)) {
    const cur = now.caseResults[id];
    if (!cur) out.push(`case ${id} is in the baseline but was not scored`);
    else if (r.pass && !cur.pass) out.push(`case ${id} passed in the baseline and now fails`);
  }
  const known = new Set(base.forbiddenViolations);
  for (const f of now.forbiddenViolations) if (!known.has(f)) out.push(`new forbidden-label violation: ${f}`);
  const EPS = 1e-9;
  for (const [kind, s] of Object.entries(base.perKind)) {
    const cur = now.perKind[kind];
    for (const m of ["precision", "recall"] as const) {
      const before = s[m];
      const after = cur ? cur[m] : null;
      // null = no predictions (precision) or no expected instances (recall) of this kind: nothing to compare.
      if (before === null || after === null) continue;
      if (after < before - EPS) out.push(`${kind} ${m} dropped: ${before} -> ${after}`);
    }
  }
  return out;
}

export async function runAll(cases: LoadedCase[]) {
  const results: CaseResult[] = [];
  for (const lc of cases) results.push(scoreCase(lc, await predictCase(lc)));
  return results;
}

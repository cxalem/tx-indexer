/**
 * Offline, deterministic accuracy scorer.
 *
 * Replays each case's recorded getTransaction response through the SDK's
 * public path (createIndexer -> getTransaction, enrichment off) once per
 * perspective, maps today's single classification to one predicted action,
 * and scores it against the hand-written expected.json.
 */
import { createHash } from "node:crypto";
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
  type ExpectedAmount,
  type ExpectedJson,
} from "./schema";

export const ACCURACY_DIR = join(import.meta.dir, "..");
export const CASES_DIR = join(ACCURACY_DIR, "cases");

export interface LoadedCase {
  dir: string;
  case: CaseJson;
  expected: ExpectedJson;
  rpcText: string;
  /** sha256 over case.json, rpc.json and expected.json bytes. */
  hash: string;
}

/** Loads and validates every case. Throws with every problem listed if any case is invalid. */
export function loadCases(casesDir = CASES_DIR): LoadedCase[] {
  const out: LoadedCase[] = [];
  const problems: string[] = [];
  for (const dir of readdirSync(casesDir).sort()) {
    const base = join(casesDir, dir);
    let rpcText: string;
    let caseText: string;
    let expectedText: string;
    try {
      rpcText = readFileSync(join(base, "rpc.json"), "utf8");
      caseText = readFileSync(join(base, "case.json"), "utf8");
      expectedText = readFileSync(join(base, "expected.json"), "utf8");
    } catch (e) {
      problems.push(`${dir}: cannot read case files (${(e as Error).message})`);
      continue;
    }
    const c = CaseSchema.safeParse(JSON.parse(caseText));
    const x = ExpectedSchema.safeParse(JSON.parse(expectedText));
    if (!c.success) problems.push(`${dir}/case.json: ${c.error.message}`);
    if (!x.success) problems.push(`${dir}/expected.json: ${x.error.message}`);
    if (!c.success || !x.success) continue;
    problems.push(...validateCase(dir, c.data, x.data, rpcText));
    const hash = createHash("sha256")
      .update("case.json\0").update(caseText)
      .update("\0rpc.json\0").update(rpcText)
      .update("\0expected.json\0").update(expectedText)
      .digest("hex");
    out.push({ dir, case: c.data, expected: x.data, rpcText, hash });
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
  decimals: number;
  /** Only set where the classification exposes it (see predictCase). */
  direction?: "in" | "out";
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

/**
 * Maps the single classification to one predicted action.
 * Direction is exposed only where the classification defines it: for `swap`,
 * primaryAmount is what the wallet sent and secondaryAmount what it received;
 * for a single amount, `out` when the perspective is the sender and `in` when
 * it is the receiver. Elsewhere amounts are compared without direction.
 */
export function toPrediction(
  address: string,
  res: NonNullable<Awaited<ReturnType<ReturnType<typeof createIndexer>["getTransaction"]>>>,
  logs: string[],
): Prediction {
  const c = res.classification;
  const amounts: PredictedAmount[] = [];
  const list = [c.primaryAmount, c.secondaryAmount ?? null];
  list.forEach((m, i) => {
    if (!m) return;
    let direction: "in" | "out" | undefined;
    if (c.primaryType === "swap") direction = i === 0 ? "out" : "in";
    else if (list.filter(Boolean).length === 1) {
      if (c.sender === address && c.receiver !== address) direction = "out";
      else if (c.receiver === address && c.sender !== address) direction = "in";
    }
    amounts.push({ mint: m.token.mint, amountRaw: m.amountRaw, decimals: m.token.decimals, direction });
  });
  return {
    address,
    kind: c.primaryType,
    sender: c.sender ?? null,
    receiver: c.receiver ?? null,
    amounts,
    feeLamports: res.legs.find((l) => l.role === "fee")?.amount.amountRaw ?? null,
    execution: res.tx.err === null || res.tx.err === undefined ? "succeeded" : "failed",
    reconciliation: res.tx.reconciliation?.status ?? "absent",
    logs,
  };
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
      const rest = args[1] as { name?: string; message?: string } | undefined;
      logs.push(`${String(args[0])}${rest && typeof rest === "object" ? ` ${rest.name ?? ""}: ${rest.message ?? ""}` : ""}`.trim());
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
      out.push(toPrediction(p.address, res, logs));
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

/**
 * Exactly one outcome per perspective (they always sum to the number of perspectives):
 * - `correct`: the prediction equals the primary action (or an `accepted` alternative)
 *   completely: kind, amounts and non-null participants. (Also: `other` for an `unknown`
 *   primary whose amounts and participants do not contradict the expectation.)
 * - `kind_only`: the primary kind is right, but amounts or participants contradict the
 *   expectation where it is non-null. Primary-kind agreement, not a correct perspective.
 * - `secondary_hit`: equals a non-primary expected action completely.
 * - `disputed_alternative`: equals a `reported` alternative completely.
 * - `abstained`: `other`, or `fee_only` where a real action was expected.
 * - `wrong_label`: anything else; a false positive for the predicted kind.
 * - `error`: the replay threw.
 */
export type Outcome =
  | "correct"
  | "kind_only"
  | "secondary_hit"
  | "disputed_alternative"
  | "abstained"
  | "wrong_label"
  | "error";

export const OUTCOMES: readonly Outcome[] = [
  "correct",
  "kind_only",
  "secondary_hit",
  "disputed_alternative",
  "abstained",
  "wrong_label",
  "error",
];

/** The non-primary expected action a secondary hit equals completely, and its exactness. */
export interface SecondaryHit {
  /** `actions[<index>] <kind> <instructionRefs>` within the perspective's expected actions */
  action: string;
  /** kind of the matched expectation (the action's own kind or an accepted alternative's) */
  kind: string;
  amountsExact: boolean | null;
  participantsExact: boolean | null;
}

/**
 * Exactness per component of the expectation the prediction was measured against: one entry per
 * expected amount leg (`<expectation> amount <direction> <mint>`) and per non-null participant field
 * (`<expectation> sender` / `<expectation> receiver`). `<expectation>` is `actions[i]` or
 * `actions[i].alternatives[j]`. Empty when nothing was measured (abstained, wrong_label, error, ...).
 * The per-perspective booleans stay for the headline; the gate compares these components so a leg
 * that was exact cannot go wrong unnoticed inside a perspective that is already inexact.
 */
export type ComponentExactness = Record<string, boolean>;

export interface PerspectiveResult {
  address: string;
  expectedKind: string;
  acceptedKinds: string[];
  predictedKind: string;
  outcome: Outcome;
  forbiddenViolation: boolean;
  amountsExact: boolean | null;
  participantsExact: boolean | null;
  components: ComponentExactness;
  /**
   * kind of the non-primary expected action the prediction equals completely, if any. Always the
   * expected action's own kind (the bucket it is counted in), also when an accepted synonym matched;
   * the matched kind is in `secondaryHit.kind` for display.
   */
  secondaryHitKind: string | null;
  secondaryHit: SecondaryHit | null;
  /** reported (disputed) alternatives and whether the prediction equals each completely */
  reported: Array<{ kind: string; predictedKind: string; completeMatch: boolean }>;
  pass: boolean;
  detail: string[];
}

export interface CaseResult {
  id: string;
  hash: string;
  categories: string[];
  disputed: boolean;
  feeAgrees: boolean;
  executionAgrees: boolean;
  reconciliation: string;
  pass: boolean;
  perspectives: PerspectiveResult[];
  /** expected non-primary actions per kind */
  secondaryExpected: Record<string, number>;
  sdkLogs: string[];
}

/** A complete expectation: kind, participants, amounts (null amounts = not checked). */
interface Expectation {
  /** `actions[i]` or `actions[i].alternatives[j]` */
  label: string;
  kind: string;
  sender: string | null;
  receiver: string | null;
  amounts: ExpectedAmount[] | null;
}

/**
 * Amounts are compared as a multiset of (mint, raw, decimals), plus direction
 * where the prediction exposes one. Native SOL and wSOL share the SOL mint in
 * the SDK, so the `native` flag is not compared.
 */
export function amountsMatch(expected: ExpectedAmount[], predicted: PredictedAmount[]): boolean {
  if (expected.length !== predicted.length) return false;
  const used = new Set<number>();
  for (const p of predicted) {
    const i = expected.findIndex(
      (e, j) =>
        !used.has(j) &&
        e.mint === p.mint &&
        e.amountRaw === p.amountRaw &&
        e.decimals === p.decimals &&
        (p.direction === undefined || p.direction === e.direction),
    );
    if (i < 0) return false;
    used.add(i);
  }
  return true;
}

function participantsMatch(e: { sender: string | null; receiver: string | null }, p: Prediction): boolean {
  if (e.sender !== null && e.sender !== p.sender) return false;
  if (e.receiver !== null && e.receiver !== p.receiver) return false;
  return true;
}

/**
 * Per-component exactness of a prediction against one expectation: each expected amount leg is
 * exact when an unused predicted amount has the same mint, raw amount and decimals (and direction
 * where the prediction exposes one); each non-null participant field is exact when it is equal.
 */
export function componentExactness(
  e: { label: string; sender: string | null; receiver: string | null; amounts: ExpectedAmount[] | null },
  p: Pick<Prediction, "sender" | "receiver" | "amounts">,
): ComponentExactness {
  const out: ComponentExactness = {};
  if (e.amounts !== null) {
    const used = new Set<number>();
    for (const leg of e.amounts) {
      const base = `${e.label} amount ${leg.direction} ${leg.mint}`;
      let key = base;
      for (let n = 2; key in out; n++) key = `${base} #${n}`;
      const i = p.amounts.findIndex(
        (m, j) =>
          !used.has(j) &&
          m.mint === leg.mint &&
          m.amountRaw === leg.amountRaw &&
          m.decimals === leg.decimals &&
          (m.direction === undefined || m.direction === leg.direction),
      );
      if (i >= 0) used.add(i);
      out[key] = i >= 0;
    }
  }
  if (e.sender !== null) out[`${e.label} sender`] = e.sender === p.sender;
  if (e.receiver !== null) out[`${e.label} receiver`] = e.receiver === p.receiver;
  return out;
}

function completeMatch(e: Expectation, p: Prediction): boolean {
  return e.kind === p.kind && (e.amounts === null || amountsMatch(e.amounts, p.amounts)) && participantsMatch(e, p);
}

function asExpectations(a: ExpectedAction, index: number, scoring: "accepted" | "reported"): Expectation[] {
  const own = scoring === "accepted" ? [{ label: `actions[${index}]`, kind: a.kind, sender: a.sender, receiver: a.receiver, amounts: a.amounts }] : [];
  const alts = (a.alternatives ?? []).flatMap((x, j) =>
    x.scoring === scoring ? [{ label: `actions[${index}].alternatives[${j}]`, kind: x.kind, sender: x.sender, receiver: x.receiver, amounts: x.amounts }] : [],
  );
  return [...own, ...alts];
}

function short(a: string | null) {
  return a ? `${a.slice(0, 4)}..${a.slice(-4)}` : "null";
}

function fmtAmounts(xs: Array<{ amountRaw: string; mint: string; direction?: string }>) {
  return xs.map((m) => `${m.direction ? m.direction + " " : ""}${m.amountRaw} ${m.mint.slice(0, 4)}`).join(", ");
}

export function scoreCase(lc: LoadedCase, preds: Prediction[]): CaseResult {
  const results: PerspectiveResult[] = [];
  let feeAgrees = true;
  let executionAgrees = true;
  const secondaryExpected: Record<string, number> = {};
  for (const ep of lc.expected.perspectives) {
    const p = preds.find((x) => x.address === ep.address)!;
    const primIndex = ep.actions.findIndex((a) => a.primary);
    const prim = ep.actions[primIndex]!;
    const others = ep.actions.filter((a) => !a.primary);
    for (const o of others) secondaryExpected[o.kind] = (secondaryExpected[o.kind] ?? 0) + 1;
    const primaryCandidates = asExpectations(prim, primIndex, "accepted");
    const accepted = primaryCandidates.map((c) => c.kind);
    const reportedAlts = ep.actions.flatMap((a, i) => asExpectations(a, i, "reported"));
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
    let amountsExact: boolean | null = null;
    let participantsExact: boolean | null = null;
    let components: ComponentExactness = {};
    let secondaryHitKind: string | null = null;
    let secondaryHit: SecondaryHit | null = null;
    // Matching order (README "Scoring"):
    // 1. complete mandatory match: primary, then accepted alternatives, then secondary actions;
    // 2. complete match of a `reported` alternative;
    // 3. kind-only fallback against the primary (and its accepted alternatives).
    // A reported KIND alone grants nothing.
    const full = primaryCandidates.find((c) => completeMatch(c, p));
    let secondary: { index: number; action: ExpectedAction; matched: Expectation } | undefined;
    if (!full) {
      for (const [index, a] of ep.actions.entries()) {
        if (a.primary) continue;
        const matched = asExpectations(a, index, "accepted").find((c) => completeMatch(c, p));
        if (matched) {
          secondary = { index, action: a, matched };
          break;
        }
      }
    }
    const reportedFull = full || secondary ? undefined : reportedAlts.find((r) => completeMatch(r, p));
    const kindOnly = primaryCandidates.find((c) => c.kind === p.kind) ??
      (prim.kind === "unknown" && p.kind === "other" ? primaryCandidates[0] : undefined);
    if (p.error) {
      outcome = "error";
      detail.push(`error: ${p.error}`);
    } else if (full) {
      outcome = "correct";
      amountsExact = full.amounts === null ? null : true;
      participantsExact = full.sender === null && full.receiver === null ? null : true;
      components = componentExactness(full, p);
    } else if (secondary) {
      outcome = "secondary_hit";
      // Count the hit in the expected action's bucket, not the matched synonym's.
      secondaryHitKind = secondary.action.kind;
      components = componentExactness(secondary.matched, p);
      secondaryHit = {
        action: `actions[${secondary.index}] ${secondary.action.kind} ${instr(secondary.action)}`,
        kind: secondary.matched.kind,
        amountsExact: secondary.matched.amounts === null ? null : true,
        participantsExact: secondary.matched.sender === null && secondary.matched.receiver === null ? null : true,
      };
      detail.push(`predicted a secondary action (${secondary.matched.kind} ${instr(secondary.action)}), expected primary ${accepted.join("|")}`);
    } else if (reportedFull) {
      outcome = "disputed_alternative";
      detail.push(`predicted ${p.kind} matching a disputed reading completely, expected ${accepted.join("|")}`);
    } else if (kindOnly) {
      components = componentExactness(kindOnly, p);
      if (kindOnly.amounts !== null) {
        amountsExact = amountsMatch(kindOnly.amounts, p.amounts);
        if (!amountsExact) detail.push(`amounts got [${fmtAmounts(p.amounts)}] want [${fmtAmounts(kindOnly.amounts)}]`);
      }
      if (kindOnly.sender !== null || kindOnly.receiver !== null) {
        participantsExact = participantsMatch(kindOnly, p);
        if (!participantsExact)
          detail.push(`participants got ${short(p.sender)}->${short(p.receiver)} want ${short(kindOnly.sender)}->${short(kindOnly.receiver)}`);
      }
      // Right kind, contradicting content: its own class, never a correct perspective.
      outcome = amountsExact === false || participantsExact === false ? "kind_only" : "correct";
      if (outcome === "kind_only") detail.unshift(`kind only (${p.kind})`);
    } else if ((p.kind === "other" && prim.kind !== "other") || (p.kind === "fee_only" && prim.kind !== "fee_only" && prim.kind !== "other")) {
      // `other` is the SDK saying "I don't know": a miss, not a wrong label. `fee_only` is an abstention only when a real action was expected.
      outcome = "abstained";
      detail.push(`predicted ${p.kind}, expected ${accepted.join("|")}`);
    } else {
      outcome = "wrong_label";
      detail.push(`predicted ${p.kind}, expected ${accepted.join("|")}`);
    }
    const forbiddenViolation = forbidden.has(p.kind);
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
      components,
      secondaryHitKind,
      secondaryHit,
      reported: reportedAlts.map((r) => ({ kind: r.kind, predictedKind: p.kind, completeMatch: completeMatch(r, p) })),
      pass,
      detail,
    });
  }
  return {
    id: lc.case.id,
    hash: lc.hash,
    categories: lc.case.categories,
    disputed: lc.expected.disputed,
    feeAgrees,
    executionAgrees,
    reconciliation: preds[0]?.reconciliation ?? "absent",
    pass: feeAgrees && executionAgrees && results.every((r) => r.pass),
    perspectives: results,
    secondaryExpected,
    sdkLogs: [...new Set(preds.flatMap((p) => p.logs))].sort(),
  };
}

function instr(a: ExpectedAction) {
  return a.instructionRefs.join(",");
}

export interface KindStats {
  tp: number;
  fp: number;
  fn: number;
  precision: number | null;
  recall: number | null;
}

export interface PerspectiveRecord {
  outcome: Outcome;
  predictedKind: string;
  amountsExact: boolean | null;
  participantsExact: boolean | null;
  /** exactness per expected amount leg and per participant field (see ComponentExactness) */
  components: ComponentExactness;
  forbiddenViolation: boolean;
  pass: boolean;
  /** set for a secondary hit: which expected action it equals, and its exactness */
  secondaryHit: SecondaryHit | null;
}

export interface CaseRecord {
  hash: string;
  pass: boolean;
  disputed: boolean;
  feeAgrees: boolean;
  executionAgrees: boolean;
  perspectives: Record<string, PerspectiveRecord>;
}

export interface Baseline {
  schemaVersion: 4;
  sdkVersion: string;
  cases: number;
  perspectives: number;
  disputedPerspectives: number;
  overall: {
    casesPassed: number;
    /** outcome `correct`: the primary action right completely (kind, amounts, non-null participants) */
    primaryCorrect: number;
    /** outcome `kind_only`: primary kind right, amounts or participants contradict the expectation */
    kindOnly: number;
    /** primaryCorrect + kindOnly = sum of per-kind TP */
    primaryKindRight: number;
    wrongLabels: number;
    abstentions: number;
    secondaryHits: number;
    disputedAlternatives: number;
    errors: number;
    forbiddenViolations: number;
    amountsExact: [number, number];
    participantsExact: [number, number];
    feeAgreement: [number, number];
    executionAgreement: [number, number];
    secondaryRecall: [number, number];
  };
  reconciliation: Record<string, number>;
  perKind: Record<string, KindStats>;
  secondaryPerKind: Record<string, [number, number]>;
  perCategory: Record<string, [number, number]>;
  forbiddenViolations: string[];
  reportedAlternatives: string[];
  caseResults: Record<string, CaseRecord>;
  failing: string[];
  /** Cases during which the SDK printed console.error/warn, with the distinct messages. */
  sdkLogs: Record<string, string[]>;
}

function ratio(a: number, b: number): number | null {
  return b === 0 ? null : Math.round((a / b) * 10000) / 10000;
}

const sortObj = <T>(x: Record<string, T>) => Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)));

export function aggregate(results: CaseResult[], sdkVersion: string): Baseline {
  const perKind: Record<string, KindStats> = {};
  const k = (name: string) => (perKind[name] ??= { tp: 0, fp: 0, fn: 0, precision: null, recall: null });
  const secondaryPerKind: Record<string, [number, number]> = {};
  const rec: Record<string, number> = {};
  const perCategory: Record<string, [number, number]> = {};
  const o: Baseline["overall"] = {
    casesPassed: 0,
    primaryCorrect: 0,
    kindOnly: 0,
    primaryKindRight: 0,
    wrongLabels: 0,
    abstentions: 0,
    secondaryHits: 0,
    disputedAlternatives: 0,
    errors: 0,
    forbiddenViolations: 0,
    amountsExact: [0, 0],
    participantsExact: [0, 0],
    feeAgreement: [0, 0],
    executionAgreement: [0, 0],
    secondaryRecall: [0, 0],
  };
  const forbiddenList: string[] = [];
  const reported: string[] = [];
  const caseResults: Record<string, CaseRecord> = {};
  const failing: string[] = [];
  const sdkLogs: Record<string, string[]> = {};
  let perspectives = 0;
  let disputedPerspectives = 0;
  for (const r of results) {
    if (r.pass) o.casesPassed++;
    rec[r.reconciliation] = (rec[r.reconciliation] ?? 0) + 1;
    o.feeAgreement[1]++;
    if (r.feeAgrees) o.feeAgreement[0]++;
    o.executionAgreement[1]++;
    if (r.executionAgrees) o.executionAgreement[0]++;
    for (const [kind, n] of Object.entries(r.secondaryExpected)) {
      (secondaryPerKind[kind] ??= [0, 0])[1] += n;
      o.secondaryRecall[1] += n;
    }
    for (const c of r.categories) {
      const t = (perCategory[c] ??= [0, 0]);
      t[1]++;
      if (r.pass) t[0]++;
    }
    const pmap: Record<string, PerspectiveRecord> = {};
    for (const p of r.perspectives) {
      perspectives++;
      if (r.disputed) disputedPerspectives++;
      pmap[p.address] = {
        outcome: p.outcome,
        predictedKind: p.predictedKind,
        amountsExact: p.amountsExact,
        participantsExact: p.participantsExact,
        components: p.components,
        forbiddenViolation: p.forbiddenViolation,
        pass: p.pass,
        secondaryHit: p.secondaryHit,
      };
      // Per kind (primary): TP = primary kind right (`correct` or `kind_only`), FN = every other
      // outcome, FP = `wrong_label` for the predicted kind.
      if (p.outcome === "correct" || p.outcome === "kind_only") {
        if (p.outcome === "correct") o.primaryCorrect++;
        else o.kindOnly++;
        o.primaryKindRight++;
        k(p.expectedKind).tp++;
      } else {
        k(p.expectedKind).fn++;
        if (p.outcome === "abstained") o.abstentions++;
        else if (p.outcome === "secondary_hit") {
          o.secondaryHits++;
          o.secondaryRecall[0]++;
          (secondaryPerKind[p.secondaryHitKind!] ??= [0, 0])[0]++;
        } else if (p.outcome === "disputed_alternative") o.disputedAlternatives++;
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
      for (const x of p.reported) {
        reported.push(`${r.id} @${p.address}: disputed reading ${x.kind}; SDK says ${x.predictedKind}${x.completeMatch ? " (complete match)" : ""}`);
      }
    }
    caseResults[r.id] = {
      hash: r.hash,
      pass: r.pass,
      disputed: r.disputed,
      feeAgrees: r.feeAgrees,
      executionAgrees: r.executionAgrees,
      perspectives: pmap,
    };
    if (!r.pass) failing.push(r.id);
    if (r.sdkLogs.length) sdkLogs[r.id] = r.sdkLogs;
  }
  for (const s of Object.values(perKind)) {
    s.precision = ratio(s.tp, s.tp + s.fp);
    s.recall = ratio(s.tp, s.tp + s.fn);
  }
  return {
    schemaVersion: 4,
    sdkVersion,
    cases: results.length,
    perspectives,
    disputedPerspectives,
    overall: o,
    reconciliation: sortObj(rec),
    perKind: sortObj(perKind),
    secondaryPerKind: sortObj(secondaryPerKind),
    perCategory: sortObj(perCategory),
    forbiddenViolations: forbiddenList.sort(),
    reportedAlternatives: reported.sort(),
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
  const prov = b.disputedPerspectives ? " *" : "";
  L.push(`tx-indexer accuracy report (sdk ${b.sdkVersion}; ${b.cases} cases, ${b.perspectives} perspectives)`);
  if (b.disputedPerspectives) {
    L.push(`* provisional: ${b.disputedPerspectives} of ${b.perspectives} perspectives come from disputed cases (their verified part is scored).`);
  }
  L.push("");
  L.push("Overall");
  L.push(`  cases where the primary action is correct for every selected perspective,`);
  L.push(`    and fee and execution status agree                          ${frac([o.casesPassed, b.cases])}${prov}`);
  L.push(`  perspectives with the primary action correct (kind, amounts`);
  L.push(`    and non-null participants all match): outcome correct       ${frac([o.primaryCorrect, b.perspectives])}${prov}`);
  L.push(`  perspectives with the primary kind right (correct + kind_only;`);
  L.push(`    = per-kind TP)                                              ${frac([o.primaryKindRight, b.perspectives])}${prov}`);
  L.push(`  Outcomes (one per perspective; they sum to ${b.perspectives})`);
  L.push(`    correct                                                     ${o.primaryCorrect}`);
  L.push(`    kind_only (kind right, amounts or participants wrong)       ${o.kindOnly}`);
  L.push(`    secondary_hit (a secondary action exactly, not the primary) ${o.secondaryHits}`);
  L.push(`    disputed_alternative (a reported reading exactly; a miss)   ${o.disputedAlternatives}`);
  L.push(`    abstained (other, or fee_only where an action was expected) ${o.abstentions}`);
  L.push(`    wrong_label (false positives)                               ${o.wrongLabels}`);
  L.push(`    error (replay errors)                                       ${o.errors}`);
  L.push(`  forbidden-label violations                                    ${o.forbiddenViolations}`);
  L.push(`  amounts exact, over perspectives with the kind right and the`);
  L.push(`    amounts known (mint, raw, decimals; direction where exposed) ${frac(o.amountsExact)}`);
  L.push(`  participants exact, over perspectives with the kind right and`);
  L.push(`    a non-null expected sender or receiver                      ${frac(o.participantsExact)}`);
  L.push(`  fee agreement (fee leg = meta.fee), per case                  ${frac(o.feeAgreement)}`);
  L.push(`  execution status agreement, per case                          ${frac(o.executionAgreement)}`);
  L.push(`  secondary actions found (recall; the SDK reports one action)  ${frac(o.secondaryRecall)}`);
  L.push(`  reconciliation status: ${Object.entries(b.reconciliation).map(([s, n]) => `${s} ${n}`).join(", ")}`);
  L.push("");
  L.push("Not part of the case-pass rule today: secondary actions (reported above), `authority`,");
  L.push("the native-vs-wSOL flag, and direction where the classification does not expose it.");
  L.push("");
  L.push("Per kind (primary action, one per perspective; TP = correct or kind_only, FN = any other");
  L.push("outcome, FP = wrong_label for the predicted kind)");
  L.push("  kind               TP  FP  FN  precision  recall");
  for (const [kind, s] of Object.entries(b.perKind)) {
    L.push(`  ${kind.padEnd(17)} ${String(s.tp).padStart(3)} ${String(s.fp).padStart(3)} ${String(s.fn).padStart(3)}     ${pct(s.precision)}  ${pct(s.recall)}`);
  }
  L.push("");
  L.push("Secondary actions per kind (found / expected)");
  for (const [kind, v] of Object.entries(b.secondaryPerKind)) L.push(`  ${kind.padEnd(17)} ${v[0]}/${v[1]}`);
  L.push("");
  L.push("Per category (cases passed)");
  for (const [c, v] of Object.entries(b.perCategory)) L.push(`  ${c.padEnd(12)} ${frac(v)}`);
  L.push("");
  if (b.forbiddenViolations.length) {
    L.push("Forbidden-label violations");
    for (const f of b.forbiddenViolations) L.push(`  ${f}`);
    L.push("");
  }
  if (b.reportedAlternatives.length) {
    L.push("Disputed interpretations (reported only: not part of the mandatory score; matching one is a miss for the primary)");
    for (const f of b.reportedAlternatives) L.push(`  ${f}`);
    L.push("");
  }
  if (Object.keys(b.sdkLogs).length) {
    L.push("SDK console output during replay (not scored)");
    for (const [id, msgs] of Object.entries(b.sdkLogs)) L.push(`  ${id}: ${msgs.join(" / ")}`);
    L.push("");
  }
  L.push(`Failing cases (${b.failing.length}); [d] = disputed case`);
  for (const r of results.filter((x) => !x.pass).sort((a, b) => a.id.localeCompare(b.id))) {
    const bits = r.perspectives
      .filter((p) => !p.pass || p.detail.length)
      .map((p) => `${short(p.address)}: ${p.detail.join("; ") || "ok"}`);
    L.push(`  ${r.disputed ? "[d] " : ""}${r.id} :: ${bits.join(" | ")}`);
  }
  return L.join("\n") + "\n";
}

/** a/b < c/d on raw counts, without rounding */
function ratioDropped(beforeNum: number, beforeDen: number, afterNum: number, afterDen: number) {
  return afterNum * beforeDen < beforeNum * afterDen;
}

/** Regressions versus a committed baseline. Empty = gate passes. */
export function compareToBaseline(base: Baseline, now: Baseline): string[] {
  const out: string[] = [];
  if (base.schemaVersion !== now.schemaVersion) return [`baseline schemaVersion ${base.schemaVersion} != ${now.schemaVersion}: regenerate`];
  for (const [id, b] of Object.entries(base.caseResults)) {
    const n = now.caseResults[id];
    if (!n) {
      out.push(`case ${id} is in the baseline but was not scored (removed?)`);
      continue;
    }
    if (n.hash !== b.hash) out.push(`case ${id}: case.json, rpc.json or expected.json changed since the baseline`);
    if (b.pass && !n.pass) out.push(`case ${id} passed in the baseline and now fails`);
    if (b.feeAgrees && !n.feeAgrees) out.push(`case ${id}: fee was right and is now wrong`);
    if (b.executionAgrees && !n.executionAgrees) out.push(`case ${id}: execution status was right and is now wrong`);
    for (const [addr, bp] of Object.entries(b.perspectives)) {
      const np = n.perspectives[addr];
      const at = `${id} @${addr}`;
      if (!np) {
        out.push(`${at}: perspective removed`);
        continue;
      }
      // A perspective may only get weaker by becoming a complete primary match (`correct`).
      if (bp.outcome === "correct" && np.outcome !== "correct") out.push(`${at}: was correct, now ${np.outcome} (${np.predictedKind})`);
      if (bp.outcome === "secondary_hit" && np.outcome !== "correct") {
        const was = bp.secondaryHit?.action ?? "?";
        if (np.outcome !== "secondary_hit") {
          out.push(`${at}: was a secondary hit (${was}), now ${np.outcome} (${np.predictedKind})`);
        } else if (np.secondaryHit?.action !== bp.secondaryHit?.action) {
          out.push(`${at}: was a secondary hit (${was}), now a secondary hit on ${np.secondaryHit?.action ?? "?"}`);
        } else {
          if (bp.secondaryHit?.amountsExact === true && np.secondaryHit?.amountsExact !== true)
            out.push(`${at}: secondary hit (${was}) amounts were exact, now not`);
          if (bp.secondaryHit?.participantsExact === true && np.secondaryHit?.participantsExact !== true)
            out.push(`${at}: secondary hit (${was}) participants were exact, now not`);
        }
      }
      if (bp.outcome === "kind_only" && np.outcome !== "correct" && np.outcome !== "kind_only") {
        out.push(`${at}: had the primary kind right (kind_only), now ${np.outcome} (${np.predictedKind})`);
      }
      if (np.outcome === "wrong_label" && (bp.outcome !== "wrong_label" || bp.predictedKind !== np.predictedKind)) {
        out.push(`${at}: new wrong label ${np.predictedKind} (was ${bp.outcome} ${bp.predictedKind})`);
      }
      if (bp.amountsExact === true && np.amountsExact === false) out.push(`${at}: amounts were exact, now wrong`);
      if (bp.participantsExact === true && np.participantsExact === false) out.push(`${at}: participants were exact, now wrong`);
      // Per component: a leg or participant field that was exact must stay exact wherever it is
      // measured, also inside a perspective that is already inexact. Only a complete primary match
      // (`correct`) may stop measuring it.
      for (const [component, wasExact] of Object.entries(bp.components)) {
        if (!wasExact || np.outcome === "correct") continue;
        const nowExact = np.components[component];
        if (nowExact === false) out.push(`${at}: ${component} was exact, now wrong`);
        else if (nowExact === undefined) out.push(`${at}: ${component} was exact, now not measured (${np.outcome} ${np.predictedKind})`);
      }
    }
    for (const addr of Object.keys(n.perspectives)) {
      if (!b.perspectives[addr]) out.push(`${id} @${addr}: perspective not in the baseline: regenerate`);
    }
  }
  for (const id of Object.keys(now.caseResults)) {
    if (!base.caseResults[id]) out.push(`case ${id} is not in the baseline: regenerate`);
  }
  const known = new Set(base.forbiddenViolations);
  for (const f of now.forbiddenViolations) if (!known.has(f)) out.push(`new forbidden-label violation: ${f}`);
  const zero: KindStats = { tp: 0, fp: 0, fn: 0, precision: null, recall: null };
  for (const kind of new Set([...Object.keys(base.perKind), ...Object.keys(now.perKind)])) {
    const b = base.perKind[kind] ?? zero;
    const n = now.perKind[kind] ?? zero;
    const bp = b.tp + b.fp;
    const np = n.tp + n.fp;
    if (bp > 0 && np > 0 && ratioDropped(b.tp, bp, n.tp, np)) out.push(`${kind} precision dropped: ${b.tp}/${bp} -> ${n.tp}/${np}`);
    if (bp === 0 && n.fp > 0) out.push(`${kind} precision n/a -> ${n.tp}/${np}: new false positives`);
    if (bp > 0 && np === 0 && b.tp > 0) out.push(`${kind} precision ${b.tp}/${bp} -> n/a: true positives lost`);
    const br = b.tp + b.fn;
    const nr = n.tp + n.fn;
    if (br > 0 && nr > 0 && ratioDropped(b.tp, br, n.tp, nr)) out.push(`${kind} recall dropped: ${b.tp}/${br} -> ${n.tp}/${nr}`);
    if (br > 0 && nr === 0) out.push(`${kind} recall ${b.tp}/${br} -> n/a: expected instances disappeared`);
  }
  return out;
}

export async function runAll(cases: LoadedCase[]) {
  const results: CaseResult[] = [];
  for (const lc of cases) results.push(scoreCase(lc, await predictCase(lc)));
  return results;
}

export async function predictAll(cases: LoadedCase[]) {
  const preds = new Map<string, Prediction[]>();
  for (const lc of cases) preds.set(lc.case.id, await predictCase(lc));
  return preds;
}

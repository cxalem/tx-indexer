/**
 * Schema for an accuracy case directory: case.json, expected.json, rpc.json.
 * `validateCase` adds the cross-file checks a plain schema cannot express.
 */
import { z } from "zod";
import type { TxPrimaryType } from "@tx-indexer/core/tx/tx.types";

/**
 * Today's TxPrimaryType vocabulary. Kept as a literal list because a runtime
 * import of TxPrimaryTypeSchema from source hits the tx.types <->
 * counterparty.types import cycle; the two checks below make `tsc` fail if the
 * list and the type ever drift apart.
 */
export const TX_PRIMARY_TYPES = [
  "transfer",
  "swap",
  "nft_purchase",
  "nft_sale",
  "nft_mint",
  "nft_receive",
  "nft_send",
  "stake_deposit",
  "stake_withdraw",
  "token_deposit",
  "token_withdraw",
  "airdrop",
  "bridge_in",
  "bridge_out",
  "reward",
  "fee_only",
  "other",
  "privacy_deposit",
  "privacy_withdraw",
] as const satisfies readonly TxPrimaryType[];
type MissingPrimaryTypes = Exclude<TxPrimaryType, (typeof TX_PRIMARY_TYPES)[number]>;
export const TX_PRIMARY_TYPES_COMPLETE: [MissingPrimaryTypes] extends [never] ? true : MissingPrimaryTypes = true;

/** Kinds outside today's TxPrimaryType vocabulary. Fixed list: do not extend without review. */
export const EXTRA_KINDS = [
  "token_burn",
  "account_close",
  "account_create",
  "wrap_sol",
  "unwrap_sol",
  "tip",
  "liquidity_add",
  "liquidity_remove",
  "lending_deposit",
  "lending_withdraw",
  "lending_borrow",
  "lending_repay",
  "token_mint",
  "unknown",
] as const;

export const ACTION_KINDS = [
  ...TX_PRIMARY_TYPES,
  ...EXTRA_KINDS,
] as const;

export const ActionKindSchema = z.string().refine((k) => (ACTION_KINDS as readonly string[]).includes(k), {
  message: "kind must be a TxPrimaryType or one of the fixed extra kinds",
});

const Address = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "base58 address");
const Raw = z.string().regex(/^\d+$/, "raw integer string");

export const AmountSchema = z
  .object({
    direction: z.enum(["in", "out"]),
    amountRaw: Raw,
    mint: Address,
    decimals: z.number().int().nonnegative(),
    /** true: native lamports; false: wSOL token account. Only meaningful for the SOL mint. */
    native: z.boolean().optional(),
  })
  .strict();

/**
 * A complete alternative expectation for a disputed or synonymous reading.
 * `accepted`: an explicit synonym that counts as correct in the mandatory score.
 * `reported`: a disputed interpretation, shown in its own report section and never scored or gated.
 */
export const AlternativeSchema = z
  .object({
    kind: ActionKindSchema,
    scoring: z.enum(["accepted", "reported"]),
    sender: Address.nullable(),
    receiver: Address.nullable(),
    amounts: z.array(AmountSchema),
    note: z.string().min(1),
  })
  .strict();

export const ActionSchema = z
  .object({
    kind: ActionKindSchema,
    primary: z.boolean(),
    sender: Address.nullable(),
    receiver: Address.nullable(),
    authority: Address.optional(),
    participantsNote: z.string().optional(),
    /** [] = no movement for this wallet; null = cannot be established from the transaction. */
    amounts: z.array(AmountSchema).nullable(),
    amountsNote: z.string().optional(),
    instructionRefs: z.array(z.string().regex(/^#\d+(\.\d+)?$/)).min(1),
    forbidden: z.array(ActionKindSchema).optional(),
    alternatives: z.array(AlternativeSchema).optional(),
    note: z.string().optional(),
  })
  .strict();

export const PerspectiveExpectedSchema = z
  .object({
    address: Address,
    actions: z.array(ActionSchema).min(1),
  })
  .strict();

export const ExpectedSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.string(),
    labelledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    labelledBeforeScoring: z.boolean(),
    fee: Raw,
    execution: z.enum(["succeeded", "failed"]),
    disputed: z.boolean(),
    openQuestions: z.array(z.string()),
    perspectives: z.array(PerspectiveExpectedSchema).min(1),
    notes: z.string(),
    /** Label changes made after the first scoring run, with who asked and why. */
    revisions: z
      .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), by: z.string(), change: z.string().min(1) }).strict())
      .optional(),
  })
  .strict();

export const CATEGORIES = ["transfer", "swap", "lifecycle", "execution", "special", "adversarial"] as const;

export const CaseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,90}$/),
    cluster: z.literal("mainnet-beta"),
    endpoint: z.string().url(),
    slot: z.number().int().positive(),
    blockTime: z.number().int().nullable(),
    transactionVersion: z.union([z.literal("legacy"), z.number().int().nonnegative()]),
    capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    commitment: z.literal("finalized"),
    encoding: z.literal("json"),
    rpc: z
      .object({
        method: z.literal("getTransaction"),
        params: z.tuple([
          z.string(),
          z
            .object({
              encoding: z.literal("json"),
              maxSupportedTransactionVersion: z.literal(1),
              commitment: z.literal("finalized"),
            })
            .strict(),
        ]),
      })
      .strict(),
    perspectives: z.array(z.object({ address: Address, reason: z.string().min(1) }).strict()).min(1),
    categories: z.array(z.enum(CATEGORIES)).min(1),
    tags: z.array(z.string()),
    rationale: z.string().min(40),
    sources: z.array(z.string()).optional(),
    recordedFrom: z.string().optional(),
    relatedFixture: z.string().optional(),
  })
  .strict();

export type CaseJson = z.infer<typeof CaseSchema>;
export type ExpectedJson = z.infer<typeof ExpectedSchema>;
export type ExpectedAction = z.infer<typeof ActionSchema>;
export type ExpectedAmount = z.infer<typeof AmountSchema>;
export type ExpectedAlternative = z.infer<typeof AlternativeSchema>;

/** Minimal view of the recorded response used by the cross-file checks (plain JSON.parse is fine here). */
interface RpcView {
  result: {
    slot: number;
    blockTime: number | null;
    version?: "legacy" | number;
    transaction: { signatures: string[]; message: { accountKeys: string[] } };
    meta: {
      fee: number;
      err: unknown;
      loadedAddresses?: { writable: string[]; readonly: string[] };
      preTokenBalances?: Array<{ owner?: string; mint: string }>;
      postTokenBalances?: Array<{ owner?: string; mint: string }>;
    };
  };
}

const SOL_MINT = "So11111111111111111111111111111111111111112";

function forbiddenOf(p: { actions: Array<{ forbidden?: string[] }> }): Set<string> {
  return new Set(p.actions.flatMap((a) => a.forbidden ?? []));
}

/** Cross-file checks. Returns a list of problems (empty = valid). */
export function validateCase(dirName: string, kase: CaseJson, expected: ExpectedJson, rpcText: string): string[] {
  const problems: string[] = [];
  const rpc = JSON.parse(rpcText) as RpcView;
  const r = rpc.result;
  if (!r) return [`${dirName}: rpc.json has no result`];
  if (kase.id !== dirName) problems.push(`id ${kase.id} != directory ${dirName}`);
  if (expected.caseId !== kase.id) problems.push(`expected.caseId ${expected.caseId} != ${kase.id}`);
  if (r.transaction.signatures[0] !== kase.signature) problems.push("signature does not match rpc.json");
  if (kase.rpc.params[0] !== kase.signature) problems.push("rpc params signature mismatch");
  if (r.slot !== kase.slot) problems.push("slot mismatch");
  if (r.blockTime !== kase.blockTime) problems.push("blockTime mismatch");
  if ((r.version ?? "legacy") !== kase.transactionVersion) problems.push("version mismatch");
  if (String(r.meta.fee) !== expected.fee) problems.push(`fee ${expected.fee} != meta.fee ${r.meta.fee}`);
  const failed = r.meta.err !== null && r.meta.err !== undefined;
  if ((failed ? "failed" : "succeeded") !== expected.execution) problems.push("execution does not match meta.err");
  if (expected.disputed !== expected.openQuestions.length > 0) problems.push("disputed must be true exactly when openQuestions exist");
  const reportedAlts = expected.perspectives.flatMap((p) => p.actions.flatMap((a) => a.alternatives ?? [])).filter((x) => x.scoring === "reported");
  if (reportedAlts.length && !expected.disputed) problems.push("reported alternatives require a disputed case with an open question");

  const la = r.meta.loadedAddresses ?? { writable: [], readonly: [] };
  const tokenRows = [...(r.meta.preTokenBalances ?? []), ...(r.meta.postTokenBalances ?? [])];
  const known = new Set<string>([...r.transaction.message.accountKeys, ...la.writable, ...la.readonly]);
  for (const t of tokenRows) if (t.owner) known.add(t.owner);
  const mints = new Set(tokenRows.map((t) => t.mint));

  const caseAddrs = kase.perspectives.map((p) => p.address);
  const expAddrs = expected.perspectives.map((p) => p.address);
  if (caseAddrs.join() !== expAddrs.join()) problems.push("perspectives differ between case.json and expected.json");
  if (new Set(caseAddrs).size !== caseAddrs.length) problems.push("duplicate perspective");

  for (const p of expected.perspectives) {
    if (!known.has(p.address)) problems.push(`perspective ${p.address} does not appear in the transaction`);
    const primaries = p.actions.filter((a) => a.primary);
    if (primaries.length !== 1) problems.push(`${p.address}: ${primaries.length} primary actions (need exactly 1)`);
    for (const a of p.actions) {
      for (const field of ["sender", "receiver", "authority"] as const) {
        const v = a[field];
        if (v && !known.has(v)) problems.push(`${p.address}: ${a.kind}.${field} ${v} not in the transaction`);
      }
      const nullParticipants = a.sender === null || a.receiver === null;
      if (nullParticipants && !a.participantsNote && !["token_mint", "token_burn", "fee_only", "other"].includes(a.kind)) {
        // a null participant needs a reason, except where the kind itself explains it
        if (!(a.sender === null && a.kind === "tip") && !(a.receiver === null && a.kind === "account_create"))
          problems.push(`${p.address}: ${a.kind} has a null participant without participantsNote`);
      }
      if (a.amounts === null && !a.amountsNote) problems.push(`${p.address}: ${a.kind} amounts null without amountsNote`);
      for (const m of a.amounts ?? []) {
        if (m.mint !== SOL_MINT && !mints.has(m.mint)) problems.push(`${p.address}: mint ${m.mint} not in token balances`);
        if (m.mint === SOL_MINT && m.native === undefined) problems.push(`${p.address}: SOL amount must say native true/false`);
      }
      if (a.forbidden?.includes(a.kind)) problems.push(`${p.address}: kind is also forbidden`);
      for (const alt of a.alternatives ?? []) {
        if (alt.scoring === "accepted" && alt.kind === a.kind) problems.push(`${p.address}: accepted alternative repeats kind`);
        for (const v of [alt.sender, alt.receiver]) {
          if (v && !known.has(v)) problems.push(`${p.address}: alternative ${alt.kind} participant ${v} not in the transaction`);
        }
        for (const m of alt.amounts) {
          if (m.mint !== SOL_MINT && !mints.has(m.mint)) problems.push(`${p.address}: alternative mint ${m.mint} not in token balances`);
        }
        if (alt.scoring === "accepted" && forbiddenOf(p).has(alt.kind)) problems.push(`${p.address}: accepted alternative ${alt.kind} is forbidden`);
      }
    }
    const forbidden = forbiddenOf(p);
    const prim = primaries[0];
    if (prim) for (const k of [prim.kind, ...(prim.alternatives ?? []).filter((x) => x.scoring === "accepted").map((x) => x.kind)]) {
      if (forbidden.has(k)) problems.push(`${p.address}: primary kind ${k} is forbidden by another action`);
    }
  }
  return problems.map((x) => `${dirName}: ${x}`);
}

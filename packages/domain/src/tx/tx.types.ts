import { ProtocolInfoSchema } from "@tx-indexer/core/actors/counterparty.types";
import { z } from "zod";
import type { Signature } from "@solana/kit";
import type { MoneyAmount } from "@tx-indexer/core/money/money.types";

export const TxDirectionSchema = z.enum([
  "incoming",
  "outgoing",
  "self",
  "neutral",
]);

export const TxPrimaryTypeSchema = z.enum([
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
]);

export const TxCategorySchema = z.enum([
  "income",
  "expense",
  "transfer",
  "investment",
  "savings",
  "fee",
  "refund",
  "tax",
  "other",
]);

export const TokenBalanceSchema = z.object({
  accountIndex: z.number(),
  mint: z.string(),
  owner: z.string().optional(),
  programId: z.string().optional(),
  uiTokenAmount: z.object({
    amount: z.string(),
    decimals: z.number(),
    uiAmountString: z.string(),
  }),
});

/**
 * Outcome of the independent lamport check for one transaction:
 * `sum(preBalances) - sum(postBalances)` over the full resolved account list
 * (static keys, then lookup-table writable, then lookup-table readonly) must
 * equal the network fee charged (`meta.fee`).
 *
 * - `balanced`: the check holds; every lamport movement is accounted for.
 * - `unbalanced`: the check fails; `residualLamports` is the unexplained
 *   difference. It is reported here and never folded into the fee leg.
 * - `unavailable`: the check could not be run (missing metadata, balance
 *   arrays that do not match the resolved key count, or values that cannot be
 *   represented exactly). No balances are fabricated in this case.
 *
 * All lamport values are decimal strings so they survive JSON serialization
 * without precision loss.
 */
export const LamportReconciliationSchema = z.object({
  status: z.enum(["balanced", "unbalanced", "unavailable"]),
  /** Network fee charged by the runtime (`meta.fee`), or null if unknown */
  feeLamports: z.string().nullable(),
  /** sum(preBalances) - sum(postBalances), or null if unavailable */
  netLamportsOut: z.string().nullable(),
  /** netLamportsOut - feeLamports; "0" when balanced, null if unavailable */
  residualLamports: z.string().nullable(),
  /** Number of resolved account keys the check ran over */
  accountCount: z.number(),
  /** Human-readable reason when status is "unavailable" or "unbalanced" */
  reason: z.string().optional(),
});

/**
 * Whether the transaction's token balance snapshots (`meta.preTokenBalances`
 * and `meta.postTokenBalances`) were present. An empty array is an available
 * snapshot; a missing one is `unavailable`, and then no token balance change is
 * derived (missing data is never read as zero balances).
 */
export const TokenBalanceStatusSchema = z.object({
  status: z.enum(["available", "unavailable"]),
  /** Which snapshot is missing, when status is "unavailable" */
  reason: z.string().optional(),
});

/** Addresses loaded from address lookup tables (v0 transactions). */
export const LoadedAddressesSchema = z.object({
  writable: z.array(z.string()),
  readonly: z.array(z.string()),
});

export const RawTransactionSchema = z.object({
  signature: z.custom<Signature>((val) => typeof val === "string"),
  slot: z.union([z.number(), z.bigint()]),
  blockTime: z.union([z.number(), z.bigint()]).nullable(),
  fee: z.number().optional(),
  err: z.any().nullable(),
  programIds: z.array(z.string()),
  protocol: ProtocolInfoSchema.nullable(),
  preTokenBalances: z.array(TokenBalanceSchema).optional(),
  postTokenBalances: z.array(TokenBalanceSchema).optional(),
  preBalances: z.array(z.union([z.number(), z.bigint()])).optional(),
  postBalances: z.array(z.union([z.number(), z.bigint()])).optional(),
  /**
   * Full resolved account list, in runtime order: static message keys, then
   * lookup-table writable addresses, then lookup-table readonly addresses.
   * `preBalances`, `postBalances` and token-balance `accountIndex` values index
   * into this list. `accountKeys[0]` is the fee payer.
   */
  accountKeys: z.array(z.string()).optional(),
  /**
   * Addresses that were loaded from address lookup tables (already included
   * at the tail of `accountKeys`). Absent for legacy transactions or when the
   * RPC response did not report them.
   */
  loadedAddresses: LoadedAddressesSchema.optional(),
  memo: z.string().nullable().optional(),
  /** Independent lamport reconciliation diagnostics (see LamportReconciliation) */
  reconciliation: LamportReconciliationSchema.optional(),
  /** Availability of the token balance snapshots (see TokenBalanceStatus) */
  tokenBalanceStatus: TokenBalanceStatusSchema.optional(),
});

const TxLegSideSchema = z.enum(["debit", "credit"]);

const TxLegRoleSchema = z.enum([
  "sent",
  "received",
  "fee",
  "reward",
  "protocol_deposit",
  "protocol_withdraw",
  "principal",
  "interest",
  "unknown",
]);

export const TxLegSchema = z.object({
  accountId: z.string(),
  side: TxLegSideSchema,
  amount: z.custom<MoneyAmount>(),
  role: TxLegRoleSchema,
  /**
   * Provenance, set by the SDK mapper ONLY on the debit of a non-native token
   * account that this transaction closed: the account has a pre token balance
   * entry and no post entry (both snapshots available) and its post lamport
   * balance is zero. The value is that token account's address. Absent on
   * every other leg, including the pre side of an owner or mint change and a
   * pre-only entry whose account still holds lamports (not proven closed).
   */
  closedTokenAccount: z.string().optional(),
});

export type TxDirection = z.infer<typeof TxDirectionSchema>;
export type TxPrimaryType = z.infer<typeof TxPrimaryTypeSchema>;
export type TxCategory = z.infer<typeof TxCategorySchema>;
export type TokenBalance = z.infer<typeof TokenBalanceSchema>;
export type RawTransaction = z.infer<typeof RawTransactionSchema>;
export type LamportReconciliation = z.infer<typeof LamportReconciliationSchema>;
export type LamportReconciliationStatus = LamportReconciliation["status"];
export type TokenBalanceStatus = z.infer<typeof TokenBalanceStatusSchema>;
export type LoadedAddresses = z.infer<typeof LoadedAddressesSchema>;
export type TxLegSide = z.infer<typeof TxLegSideSchema>;
export type TxLegRole = z.infer<typeof TxLegRoleSchema>;
export type TxLeg = z.infer<typeof TxLegSchema>;

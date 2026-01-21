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
  // Privacy transaction types (Solana Privacy Hack 2026)
  "privacy_deposit", // Shielding funds into privacy pool
  "privacy_withdraw", // Unshielding funds from pool
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
  accountKeys: z.array(z.string()).optional(),
  memo: z.string().nullable().optional(),
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
});

export type TxDirection = z.infer<typeof TxDirectionSchema>;
export type TxPrimaryType = z.infer<typeof TxPrimaryTypeSchema>;
export type TxCategory = z.infer<typeof TxCategorySchema>;
export type TokenBalance = z.infer<typeof TokenBalanceSchema>;
export type RawTransaction = z.infer<typeof RawTransactionSchema>;
export type TxLegSide = z.infer<typeof TxLegSideSchema>;
export type TxLegRole = z.infer<typeof TxLegRoleSchema>;
export type TxLeg = z.infer<typeof TxLegSchema>;

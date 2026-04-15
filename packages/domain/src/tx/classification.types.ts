import { z } from "zod";
import { TxPrimaryTypeSchema } from "./tx.types";
import { CounterpartySchema } from "@tx-indexer/core/actors/counterparty.types";
import type { MoneyAmount } from "@tx-indexer/core/money/money.types";

export const ClassifierDecisionTraceSchema = z.object({
  classifier: z.string(),
  priority: z.number().int(),
  matched: z.boolean(),
  relevant: z.boolean(),
  reason: z.string(),
  elapsedMs: z.number().nonnegative().optional(),
});

export const ClassificationDebugTraceSchema = z.object({
  selectedClassifier: z.string().nullable(),
  selectedType: TxPrimaryTypeSchema.nullable(),
  walletAddress: z.string().nullable().optional(),
  decisions: z.array(ClassifierDecisionTraceSchema),
});

export const TransactionClassificationSchema = z.object({
  primaryType: TxPrimaryTypeSchema,
  primaryAmount: z.custom<MoneyAmount>().nullable(),
  secondaryAmount: z.custom<MoneyAmount>().nullable().optional(),
  sender: z.string().nullable().optional(),
  receiver: z.string().nullable().optional(),
  /**
   * Best-effort counterparty information based on known protocol addresses.
   * This is for display purposes only and may not always be accurate.
   * Do not rely on this for security-critical decisions.
   */
  counterparty: CounterpartySchema.nullable(),
  confidence: z.number().min(0).max(1),
  isRelevant: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  debugTrace: ClassificationDebugTraceSchema.optional(),
});

export type TransactionClassification = z.infer<
  typeof TransactionClassificationSchema
>;
export type ClassifierDecisionTrace = z.infer<
  typeof ClassifierDecisionTraceSchema
>;
export type ClassificationDebugTrace = z.infer<
  typeof ClassificationDebugTraceSchema
>;

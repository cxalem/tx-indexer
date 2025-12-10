import { z } from "zod";
import { TxPrimaryTypeSchema, TxDirectionSchema } from "./tx.types";
import { CounterpartySchema } from "@tx-indexer/core/actors/counterparty.types";

export const TransactionClassificationSchema = z.object({
  primaryType: TxPrimaryTypeSchema,
  direction: TxDirectionSchema,
  primaryAmount: z.any().nullable(),
  secondaryAmount: z.any().nullable().optional(),
  counterparty: CounterpartySchema.nullable(),
  confidence: z.number().min(0).max(1),
  isRelevant: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type TransactionClassification = z.infer<
  typeof TransactionClassificationSchema
>;


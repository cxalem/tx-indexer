import { z } from "zod";
import { TxCategorySchema } from "@tx-indexer/core/tx/tx.types";

const CounterpartyTypeSchema = z.enum([
  "person",
  "merchant",
  "exchange",
  "protocol",
  "own_wallet",
  "unknown",
]);

export const CounterpartySchema = z.object({
  type: CounterpartyTypeSchema,
  address: z.string(),
  name: z.string().optional(),
  avatarUrl: z.url().optional(),
  refCode: z.string().optional(),
});

export const ProtocolInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  iconUrl: z.url().optional(),
  programIds: z.array(z.string()).optional(),
  url: z.url().optional(),
});

export const CategorizationSchema = z.object({
  category: TxCategorySchema,
  subcategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  budgetId: z.string().optional(),
  isRecurringHint: z.boolean().optional(),
  merchantId: z.string().optional(),
});

export type Counterparty = z.infer<typeof CounterpartySchema>;
export type ProtocolInfo = z.infer<typeof ProtocolInfoSchema>;
export type Categorization = z.infer<typeof CategorizationSchema>;
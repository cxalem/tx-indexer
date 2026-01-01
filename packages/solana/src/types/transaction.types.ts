import { z } from "zod";
import type { Address } from "@solana/kit";

export const TransactionInstructionSchema = z.object({
  programIdIndex: z.number(),
  accounts: z.array(z.number()).readonly().optional(),
  data: z.string().optional(),
});

export const TransactionHeaderSchema = z.object({
  numRequiredSignatures: z.number(),
  numReadonlySignedAccounts: z.number(),
  numReadonlyUnsignedAccounts: z.number(),
});

export const TransactionMessageSchema = z.object({
  accountKeys: z.custom<readonly Address[]>(),
  instructions: z.array(TransactionInstructionSchema).readonly(),
  recentBlockhash: z.string().optional(),
  header: TransactionHeaderSchema.optional(),
});

export const InnerInstructionSchema = z.object({
  index: z.number(),
  instructions: z.array(TransactionInstructionSchema).readonly(),
});

export const SolanaTransactionSchema = z.object({
  message: TransactionMessageSchema,
  signatures: z.array(z.string()).readonly(),
});

export type InnerInstruction = z.infer<typeof InnerInstructionSchema>;
export type SolanaTransaction = z.infer<typeof SolanaTransactionSchema>;
export type TransactionMessage = z.infer<typeof TransactionMessageSchema>;
export type TransactionInstruction = z.infer<
  typeof TransactionInstructionSchema
>;
export type TransactionHeader = z.infer<typeof TransactionHeaderSchema>;

import { z } from "zod";

// Base58 character set (no 0, O, I, l)
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * Solana address validation schema
 * - Must be 32-44 characters (base58 encoded public key)
 * - Must only contain valid base58 characters
 */
export const solanaAddressSchema = z
  .string()
  .min(32, "Address must be at least 32 characters")
  .max(44, "Address must be at most 44 characters")
  .regex(BASE58_REGEX, "Invalid Solana address format");

/**
 * Wallet label validation schema
 * - Must be 1-50 characters
 * - Trimmed of whitespace
 */
export const walletLabelSchema = z
  .string()
  .min(1, "Label is required")
  .max(50, "Label must be at most 50 characters")
  .transform((val) => val.trim());

/**
 * Transfer amount validation schema
 * - Must be a positive number
 * - Maximum 2 decimal places for USDC (but we allow more for flexibility)
 */
export const transferAmountSchema = z
  .number()
  .positive("Amount must be greater than 0")
  .max(1_000_000_000, "Amount exceeds maximum");

/**
 * Transfer memo/description validation schema
 * - Optional
 * - Maximum 256 characters (Solana memo limit)
 */
export const transferMemoSchema = z
  .string()
  .max(256, "Memo must be at most 256 characters")
  .optional()
  .transform((val) => val?.trim() || undefined);

/**
 * Wallet label upsert input schema
 */
export const upsertWalletLabelSchema = z.object({
  address: solanaAddressSchema,
  label: walletLabelSchema,
});

/**
 * Transfer input schema
 */
export const transferInputSchema = z.object({
  recipient: solanaAddressSchema,
  amount: transferAmountSchema,
  memo: transferMemoSchema,
});

/**
 * Dashboard data input schema
 */
export const dashboardDataSchema = z.object({
  walletAddress: solanaAddressSchema,
  transactionLimit: z.number().int().positive().max(100).default(10),
});

/**
 * Fee estimate input schema
 */
export const feeEstimateSchema = z.object({
  recipientAddress: solanaAddressSchema,
});

/**
 * Auth verify input schema
 */
export const authVerifySchema = z.object({
  walletAddress: solanaAddressSchema,
  signature: z.string().min(1, "Signature is required"),
  message: z.string().min(1, "Message is required"),
  nonce: z.string().min(1, "Nonce is required"),
});

/**
 * Helper function to validate Solana address (for use in components)
 */
export function isValidSolanaAddress(address: string): boolean {
  return solanaAddressSchema.safeParse(address).success;
}

/**
 * Helper to safely parse and get validation errors
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.issues[0];
  return {
    success: false,
    error: firstError?.message || "Validation failed",
  };
}

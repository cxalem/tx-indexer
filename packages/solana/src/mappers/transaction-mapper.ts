import type { SolanaTransaction } from "@tx-indexer/solana/types/transaction.types";

/**
 * Extracts all unique program IDs from a transaction.
 *
 * @param transaction - Raw transaction object from RPC
 * @returns Array of program ID strings
 */
export function extractProgramIds(transaction: SolanaTransaction): string[] {
  const programIds = new Set<string>();

  const { message } = transaction;
  const { accountKeys, instructions } = message;

  for (const ix of instructions) {
    const { programIdIndex } = ix;
    if (programIdIndex !== undefined && accountKeys[programIdIndex]) {
      const key = accountKeys[programIdIndex];
      programIds.add(key.toString());
    }
  }

  return Array.from(programIds);
}

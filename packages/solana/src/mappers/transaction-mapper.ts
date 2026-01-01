import type {
  SolanaTransaction,
  InnerInstruction,
} from "@tx-indexer/solana/types/transaction.types";

/**
 * Extracts all unique program IDs from a transaction's top-level instructions.
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

/**
 * Extracts program IDs from inner instructions (CPI calls).
 */
export function extractInnerProgramIds(
  innerInstructions: InnerInstruction[] | undefined,
  allAccountKeys: string[]
): string[] {
  if (!innerInstructions) return [];

  const programIds = new Set<string>();

  for (const block of innerInstructions) {
    for (const ix of block.instructions) {
      const key = allAccountKeys[ix.programIdIndex];
      if (key) programIds.add(key);
    }
  }

  return Array.from(programIds);
}

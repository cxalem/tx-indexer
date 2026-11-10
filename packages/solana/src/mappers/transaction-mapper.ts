import type {
  SolanaTransaction,
  InnerInstruction,
} from "@tx-indexer/solana/types/transaction.types";

/**
 * Extracts all unique program IDs from a transaction's top-level instructions.
 *
 * Uses the static message keys. That is sufficient and exact: the runtime does
 * not allow a top-level instruction's program id to be loaded from an address
 * lookup table, so `programIdIndex` always points into the static keys, which
 * are also the prefix of the resolved account list (see resolveAccountKeys).
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
 *
 * Inner instructions may reference lookup-table accounts, so `allAccountKeys`
 * must be the full resolved list (static, then loaded writable, then loaded
 * readonly), e.g. `RawTransaction.accountKeys` or `resolveAccountKeys(...)`.
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

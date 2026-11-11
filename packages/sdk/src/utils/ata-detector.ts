/**
 * ATA (Associated Token Account) Detection Utilities
 *
 * Detects newly created ATAs from transaction data by comparing
 * pre and post token balances. A new ATA is created when a token
 * account appears in postTokenBalances but not in preTokenBalances.
 */

import type {
  RawTransaction,
  TokenBalance,
} from "@tx-indexer/core/tx/tx.types";

/**
 * Represents a newly detected ATA
 */
export interface DetectedATA {
  /** The mint address of the token */
  mint: string;
  /** The owner of the ATA (the wallet that now has this token account) */
  owner: string;
  /** The account index in the transaction */
  accountIndex: number;
  /** The token account address (if available from accountKeys) */
  tokenAccount?: string;
}

/**
 * Detects newly created ATAs from a transaction by comparing
 * preTokenBalances and postTokenBalances.
 *
 * A new ATA is detected when:
 * - An accountIndex appears in postTokenBalances but not in preTokenBalances
 * - The owner field is present (identifies who owns the new ATA)
 *
 * @param tx - The raw transaction to analyze
 * @returns Array of detected new ATAs
 *
 * @example
 * ```typescript
 * const newATAs = detectNewATAs(transaction.tx);
 * for (const ata of newATAs) {
 *   console.log(`New ATA for ${ata.owner}: mint ${ata.mint}`);
 * }
 * ```
 */
export function detectNewATAs(tx: RawTransaction): DetectedATA[] {
  const {
    preTokenBalances = [],
    postTokenBalances = [],
    accountKeys = [],
  } = tx;

  // Build a set of account indices that existed before the transaction
  const preAccountIndices = new Set(
    preTokenBalances.map((b: TokenBalance) => b.accountIndex),
  );

  // Find token accounts that exist after but didn't exist before
  const newATAs: DetectedATA[] = [];

  for (const post of postTokenBalances) {
    // Skip if this account existed before (not a new ATA)
    if (preAccountIndices.has(post.accountIndex)) {
      continue;
    }

    // Skip if no owner information (can't determine who owns it)
    if (!post.owner) {
      continue;
    }

    const detected: DetectedATA = {
      mint: post.mint,
      owner: post.owner,
      accountIndex: post.accountIndex,
    };

    // Try to get the actual token account address from accountKeys
    if (accountKeys.length > post.accountIndex) {
      detected.tokenAccount = accountKeys[post.accountIndex];
    }

    newATAs.push(detected);
  }

  return newATAs;
}

/**
 * Checks if a transaction created any new ATAs for a specific owner.
 *
 * @param tx - The raw transaction to analyze
 * @param ownerAddress - The wallet address to check for new ATAs
 * @returns True if the transaction created at least one new ATA for the owner
 */
export function hasNewATAForOwner(
  tx: RawTransaction,
  ownerAddress: string,
): boolean {
  const newATAs = detectNewATAs(tx);
  return newATAs.some((ata) => ata.owner === ownerAddress);
}

/**
 * Gets all new ATA token account addresses for a specific owner from a transaction.
 *
 * @param tx - The raw transaction to analyze
 * @param ownerAddress - The wallet address to check for new ATAs
 * @returns Array of new token account addresses (if available)
 */
export function getNewATAsForOwner(
  tx: RawTransaction,
  ownerAddress: string,
): DetectedATA[] {
  const newATAs = detectNewATAs(tx);
  return newATAs.filter((ata) => ata.owner === ownerAddress);
}

/**
 * Batch detect new ATAs across multiple transactions.
 * Groups results by owner address for efficient cache invalidation.
 *
 * @param transactions - Array of raw transactions to analyze
 * @returns Map of owner address to their new ATAs
 */
export function detectNewATAsBatch(
  transactions: RawTransaction[],
): Map<string, DetectedATA[]> {
  const byOwner = new Map<string, DetectedATA[]>();

  for (const tx of transactions) {
    const newATAs = detectNewATAs(tx);
    for (const ata of newATAs) {
      const existing = byOwner.get(ata.owner) || [];
      existing.push(ata);
      byOwner.set(ata.owner, existing);
    }
  }

  return byOwner;
}

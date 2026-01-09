"use server";

import { getIndexer } from "@/lib/indexer";
import type { ClassifiedTransaction } from "tx-indexer";

export async function getWalletTransactions(
  walletAddress: string,
  limit: number = 5,
): Promise<ClassifiedTransaction[]> {
  const indexer = getIndexer();
  return indexer.getTransactions(walletAddress, {
    limit,
    // Include token account signatures to see incoming SPL transfers
    includeTokenAccounts: true,
  });
}

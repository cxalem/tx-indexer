"use server";

import { getIndexer } from "@/lib/indexer";
import type { ClassifiedTransaction, WalletBalance } from "tx-indexer";
import { address } from "@solana/kit";

export interface DashboardData {
  balance: WalletBalance;
  transactions: ClassifiedTransaction[];
}

export async function getDashboardData(
  walletAddress: string,
  transactionLimit: number = 10,
): Promise<DashboardData> {
  const indexer = getIndexer();
  const addr = address(walletAddress);

  const [balance, transactions] = await Promise.all([
    indexer.getBalance(addr),
    indexer.getTransactions(addr, { limit: transactionLimit }),
  ]);

  return { balance, transactions };
}

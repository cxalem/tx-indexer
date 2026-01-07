"use server";

import { getIndexer } from "@/lib/indexer";
import { fetchTokenPrices } from "@/lib/prices";
import type { ClassifiedTransaction, WalletBalance } from "tx-indexer";
import { address } from "@solana/kit";
import { dashboardDataSchema } from "@/lib/validations";

const STABLECOIN_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
  "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH", // USDG
  "A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM", // USDC Bridged
  "EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCCi3Z4dPuFhh", // DAI
]);

const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface PortfolioSummary {
  totalUsd: number;
  stablecoinsUsd: number;
  variableAssetsUsd: number;
  unpricedCount: number;
}

export interface DashboardData {
  balance: WalletBalance;
  portfolio: PortfolioSummary;
  transactions: ClassifiedTransaction[];
}

async function calculatePortfolio(
  balance: WalletBalance,
): Promise<PortfolioSummary> {
  let stablecoinsUsd = 0;
  let variableAssetsUsd = 0;
  let unpricedCount = 0;

  const variableTokenMints: string[] = [SOL_MINT];
  const variableTokenAmounts = new Map<string, number>();
  variableTokenAmounts.set(SOL_MINT, balance.sol.ui);

  for (const token of balance.tokens) {
    if (STABLECOIN_MINTS.has(token.mint)) {
      stablecoinsUsd += token.amount.ui;
    } else {
      variableTokenMints.push(token.mint);
      variableTokenAmounts.set(token.mint, token.amount.ui);
    }
  }

  const prices = await fetchTokenPrices(variableTokenMints);

  variableTokenAmounts.forEach((amount, mint) => {
    const price = prices.get(mint);
    if (price !== undefined) {
      variableAssetsUsd += amount * price;
    } else {
      unpricedCount++;
    }
  });

  return {
    totalUsd: stablecoinsUsd + variableAssetsUsd,
    stablecoinsUsd,
    variableAssetsUsd,
    unpricedCount,
  };
}

export async function getDashboardData(
  walletAddress: string,
  transactionLimit: number = 10,
): Promise<DashboardData> {
  // Validate inputs with Zod
  const validationResult = dashboardDataSchema.safeParse({
    walletAddress,
    transactionLimit,
  });

  if (!validationResult.success) {
    throw new Error("Invalid input parameters");
  }

  const { walletAddress: validAddress, transactionLimit: validLimit } =
    validationResult.data;

  const indexer = getIndexer();
  const addr = address(validAddress);

  const [balance, transactions] = await Promise.all([
    indexer.getBalance(addr),
    indexer.getTransactions(addr, { limit: validLimit }),
  ]);

  const portfolio = await calculatePortfolio(balance);

  return { balance, portfolio, transactions };
}

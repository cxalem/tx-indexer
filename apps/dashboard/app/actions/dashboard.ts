"use server";

import { getIndexer } from "@/lib/indexer";
import { fetchTokenPrices } from "@/lib/prices";
import type { ClassifiedTransaction } from "tx-indexer";
import type { WalletBalance } from "tx-indexer/advanced";
import { address, signature } from "@solana/kit";
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

/**
 * Fetch new transactions since a known signature (for incremental updates)
 * This dramatically reduces RPC calls on polling - only fetches what's new
 */
export async function getNewTransactions(
  walletAddress: string,
  untilSignature: string,
  limit: number = 10,
): Promise<ClassifiedTransaction[]> {
  const indexer = getIndexer();
  const addr = address(walletAddress);

  return indexer.getTransactions(addr, {
    limit,
    until: signature(untilSignature),
    includeTokenAccounts: true,
    retry: { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 5000 },
  });
}

/**
 * Fetch only balance and portfolio (no transactions)
 * Used for polling when we already have cached transactions
 */
export async function getBalanceAndPortfolio(
  walletAddress: string,
): Promise<{ balance: WalletBalance; portfolio: PortfolioSummary }> {
  const indexer = getIndexer();
  const addr = address(walletAddress);

  const balance = await indexer.getBalance(addr);
  const portfolio = await calculatePortfolio(balance);

  return { balance, portfolio };
}

/**
 * Fetch a page of transactions with cursor-based pagination
 * Used for infinite scroll in the transactions feed
 */
export async function getTransactionsPage(
  walletAddress: string,
  options: {
    limit?: number;
    cursor?: string; // Transaction signature to start after (oldest loaded)
  } = {},
): Promise<{
  transactions: ClassifiedTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const { limit = 20, cursor } = options;

  const indexer = getIndexer();
  const addr = address(walletAddress);

  const retryConfig = {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
  };

  const transactions = await indexer.getTransactions(addr, {
    limit: limit + 1,
    before: cursor ? signature(cursor) : undefined,
    includeTokenAccounts: true,
    retry: retryConfig,
  });

  const hasMore = transactions.length > limit;
  const pageTransactions = hasMore
    ? transactions.slice(0, limit)
    : transactions;
  const nextCursor =
    pageTransactions.length > 0
      ? (pageTransactions[pageTransactions.length - 1]?.tx.signature ?? null)
      : null;

  return {
    transactions: pageTransactions,
    nextCursor,
    hasMore,
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

  // Retry config for rate limiting resilience
  const retryConfig = {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
  };

  const balance = await indexer.getBalance(addr);
  const transactions = await indexer.getTransactions(addr, {
    limit: validLimit,
    includeTokenAccounts: true,
    retry: retryConfig,
  });

  const portfolio = await calculatePortfolio(balance);

  return { balance, portfolio, transactions };
}

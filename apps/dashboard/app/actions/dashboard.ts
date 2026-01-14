"use server";

import { getIndexer } from "@/lib/indexer";
import { fetchTokenPrices } from "@/lib/prices";
import type { ClassifiedTransaction } from "tx-indexer";
import type { WalletBalance } from "tx-indexer/advanced";
import { address, signature } from "@solana/kit";
import {
  STABLECOIN_MINTS,
  SOL_MINT,
  DEFAULT_TRANSACTION_LIMIT,
  DEFAULT_PAGE_SIZE,
} from "@/lib/constants";
import {
  getCachedTransactions,
  setCachedTransactions,
  prependToCache,
  appendToCache,
} from "@/lib/transaction-cache";

// =============================================================================
// RPC OPTIMIZATION CONFIG
// =============================================================================
// These settings reduce RPC calls significantly for rate-limited RPCs (e.g., Helius free tier)
// Set OPTIMIZE_FOR_RATE_LIMITS=true in env to enable aggressive optimization

const OPTIMIZE_FOR_RATE_LIMITS =
  process.env.OPTIMIZE_FOR_RATE_LIMITS === "true";

/**
 * Default SDK options optimized for the current RPC tier.
 *
 * Rate-limited mode (OPTIMIZE_FOR_RATE_LIMITS=true):
 * - overfetchMultiplier: 1 (no overfetch, saves ~50% of RPC calls)
 * - minPageSize: matches limit (no minimum)
 *
 * Standard mode:
 * - overfetchMultiplier: 2 (fetch extra to account for spam filtering)
 * - minPageSize: 20 (ensures good batch sizes)
 *
 * NOTE: includeTokenAccounts is always true because incoming SPL token transfers
 * (like USDC) only appear in the receiver's Associated Token Account (ATA),
 * not their wallet address. Without this, receivers won't see incoming tokens.
 */
const getOptimizedOptions = (limit: number) => ({
  // Rate-limit friendly settings reduce overfetch
  overfetchMultiplier: OPTIMIZE_FOR_RATE_LIMITS ? 1 : 2,
  minPageSize: OPTIMIZE_FOR_RATE_LIMITS ? limit : 20,
  // Required for incoming SPL token transfers - receiver's wallet isn't in
  // accountKeys, only their ATA is, so we must query token accounts
  includeTokenAccounts: true,
  // Retry config for resilience
  retry: {
    maxAttempts: 3,
    baseDelayMs: OPTIMIZE_FOR_RATE_LIMITS ? 1000 : 500,
    maxDelayMs: OPTIMIZE_FOR_RATE_LIMITS ? 10000 : 5000,
  },
});

export interface PortfolioSummary {
  totalUsd: number;
  stablecoinsUsd: number;
  variableAssetsUsd: number;
  unpricedCount: number;
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
 *
 * Returns empty array quickly if no new transactions exist.
 */
export async function getNewTransactions(
  walletAddress: string,
  untilSignature: string,
  limit: number = DEFAULT_TRANSACTION_LIMIT,
): Promise<ClassifiedTransaction[]> {
  const indexer = getIndexer();
  const addr = address(walletAddress);
  const opts = getOptimizedOptions(limit);

  const newTxs = await indexer.getTransactions(addr, {
    limit,
    until: signature(untilSignature),
    ...opts,
  });

  // Update server cache with new transactions (fire and forget)
  if (newTxs.length > 0) {
    prependToCache(walletAddress, newTxs).catch((err) =>
      console.error("[Cache] Failed to prepend:", err),
    );
  }

  return newTxs;
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
 * Uses aggressive cache-first strategy for instant loads.
 *
 * Cache strategy (Aggressive):
 * - First page: ALWAYS return cache immediately if available
 * - Return `cachedLatestSignature` so client can fetch gap in background
 * - Subsequent pages: Check cache first, then RPC
 *
 * This means:
 * - Page loads are instant (0ms for cached wallets)
 * - New transactions are fetched in background and animate in
 * - RPC is only hit for truly new data
 */
export async function getTransactionsPage(
  walletAddress: string,
  options: {
    limit?: number;
    cursor?: string; // Transaction signature to start after (oldest loaded)
    forceRefresh?: boolean; // Skip cache and fetch fresh data
  } = {},
): Promise<{
  transactions: ClassifiedTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
  fromCache: boolean;
  cachedLatestSignature: string | null; // For client to fetch gap
}> {
  const { limit = DEFAULT_PAGE_SIZE, cursor, forceRefresh = false } = options;

  // For the first page (no cursor), ALWAYS check cache first (aggressive strategy)
  if (!cursor && !forceRefresh) {
    const cached = await getCachedTransactions(walletAddress);
    if (cached && cached.transactions.length > 0) {
      // Return cached data immediately - client will fetch gap in background
      const pageTransactions = cached.transactions.slice(0, limit);
      const nextCursor =
        pageTransactions.length > 0
          ? (pageTransactions[pageTransactions.length - 1]?.tx.signature ??
            null)
          : null;

      console.log(
        `[Redis Cache] HIT for ${walletAddress.slice(0, 8)}... - ${pageTransactions.length} txs (latest: ${cached.latestSignature?.slice(0, 8)}...)`,
      );

      return {
        transactions: pageTransactions,
        nextCursor,
        hasMore: cached.transactions.length > limit || cached.hasMore,
        fromCache: true,
        cachedLatestSignature: cached.latestSignature, // Client uses this to fetch gap
      };
    }
    console.log(`[Redis Cache] MISS for ${walletAddress.slice(0, 8)}...`);
  }

  // For pagination with cursor, check if we have this page in cache
  if (cursor && !forceRefresh) {
    const cached = await getCachedTransactions(walletAddress);
    if (cached && cached.transactions.length > 0) {
      // Find the cursor position in cached transactions
      const cursorIndex = cached.transactions.findIndex(
        (tx) => tx.tx.signature === cursor,
      );

      if (cursorIndex !== -1) {
        // We have transactions after this cursor in cache
        const startIndex = cursorIndex + 1;
        const pageTransactions = cached.transactions.slice(
          startIndex,
          startIndex + limit,
        );

        if (pageTransactions.length > 0) {
          const nextCursor =
            pageTransactions[pageTransactions.length - 1]?.tx.signature ?? null;
          const cacheHasMore = startIndex + limit < cached.transactions.length;

          console.log(
            `[Redis Cache] HIT (pagination) for ${walletAddress.slice(0, 8)}... - ${pageTransactions.length} txs`,
          );

          return {
            transactions: pageTransactions,
            nextCursor,
            hasMore: cacheHasMore || cached.hasMore,
            fromCache: true,
            cachedLatestSignature: null, // Not needed for pagination
          };
        }
      }
    }
  }

  // Fetch from RPC
  const indexer = getIndexer();
  const addr = address(walletAddress);
  const opts = getOptimizedOptions(limit + 1);

  const transactions = await indexer.getTransactions(addr, {
    limit: limit + 1,
    before: cursor ? signature(cursor) : undefined,
    ...opts,
  });

  const hasMore = transactions.length > limit;
  const pageTransactions = hasMore
    ? transactions.slice(0, limit)
    : transactions;
  const nextCursor =
    pageTransactions.length > 0
      ? (pageTransactions[pageTransactions.length - 1]?.tx.signature ?? null)
      : null;

  console.log(
    `[RPC] Fetched ${pageTransactions.length} transactions for ${walletAddress.slice(0, 8)}...`,
  );

  // Update server cache (fire and forget to not block response)
  if (!cursor) {
    // First page - set the cache
    setCachedTransactions(walletAddress, pageTransactions, hasMore)
      .then(() =>
        console.log(
          `[Redis Cache] SET for ${walletAddress.slice(0, 8)}... - ${pageTransactions.length} transactions`,
        ),
      )
      .catch((err) => console.error("[Cache] Failed to set:", err));
  } else {
    // Subsequent pages - append to cache
    appendToCache(walletAddress, pageTransactions, hasMore)
      .then(() =>
        console.log(
          `[Redis Cache] APPEND for ${walletAddress.slice(0, 8)}... - ${pageTransactions.length} transactions`,
        ),
      )
      .catch((err) => console.error("[Cache] Failed to append:", err));
  }

  return {
    transactions: pageTransactions,
    nextCursor,
    hasMore,
    fromCache: false,
    cachedLatestSignature: null, // Fresh data, no gap to fill
  };
}

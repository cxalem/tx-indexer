"use server";

import { getIndexer } from "@/lib/indexer";
import { fetchTokenPrices } from "@/lib/prices";
import type {
  ClassifiedTransaction,
  SignatureInfo,
  GetSignaturesResult,
  WalletFundingSource,
} from "tx-indexer";
import type { WalletBalance } from "tx-indexer/advanced";
import { address, signature } from "@solana/kit";
import {
  enrichWalletBalance,
  type EnrichedWalletBalance,
} from "./token-metadata";
import { getNftsForWallet, type NftAsset } from "./nfts";
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
import {
  getCachedSignature,
  getCachedSignatures,
  setCachedSignatures,
} from "@/lib/signature-cache";
import { invalidateTokenAccountCache } from "@/lib/token-account-cache";
import { detectNewATAsBatch } from "tx-indexer";
import {
  startRequestMetrics,
  recordRpcCall,
  recordCacheStats,
  finishRequestMetrics,
  type RequestMetrics,
} from "@/lib/rpc-metrics";

// =============================================================================
// SIGNATURE CACHE HELPERS
// =============================================================================

/**
 * Cache transactions by their signatures for cross-wallet deduplication.
 * This runs async and doesn't block the response.
 */
async function cacheTransactionsBySignature(
  transactions: ClassifiedTransaction[],
): Promise<void> {
  if (transactions.length === 0) return;

  try {
    await setCachedSignatures(transactions);
    console.log(
      `[Sig Cache] Cached ${transactions.length} transactions by signature`,
    );
  } catch (err) {
    console.error("[Sig Cache] Failed to cache:", err);
  }
}

// =============================================================================
// ATA CACHE INVALIDATION HELPERS
// =============================================================================

/**
 * Check transactions for new ATAs and invalidate the token account cache
 * for any wallet that received a new ATA.
 * This runs async and doesn't block the response.
 */
async function checkAndInvalidateATACache(
  transactions: ClassifiedTransaction[],
  currentWallet: string,
): Promise<void> {
  if (transactions.length === 0) return;

  try {
    // Extract raw transactions for ATA detection
    const rawTxs = transactions.map((tx) => tx.tx);
    const newATAsByOwner = detectNewATAsBatch(rawTxs);

    if (newATAsByOwner.size === 0) {
      return;
    }

    // Invalidate cache for each owner that got a new ATA
    const invalidationPromises: Promise<void>[] = [];

    for (const [owner, atas] of newATAsByOwner) {
      console.log(
        `[ATA Cache] Detected ${atas.length} new ATA(s) for ${owner.slice(0, 8)}... (mints: ${atas.map((a) => a.mint.slice(0, 8)).join(", ")})`,
      );
      invalidationPromises.push(invalidateTokenAccountCache(owner));
    }

    await Promise.all(invalidationPromises);
  } catch (err) {
    console.error("[ATA Cache] Failed to check/invalidate:", err);
  }
}

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

export interface WalletIdentity {
  address: string;
  type?: string;
  name?: string;
  category?: string;
  tags?: string[];
}

function getHeliusApiKeyFromServerRpcUrl(): string | null {
  const rpcUrl = process.env.SERVER_RPC_URL;
  if (!rpcUrl) return process.env.HELIUS_API_KEY ?? null;

  try {
    const parsed = new URL(rpcUrl);
    return (
      parsed.searchParams.get("api-key") ??
      parsed.searchParams.get("api_key") ??
      process.env.HELIUS_API_KEY ??
      null
    );
  } catch {
    return process.env.HELIUS_API_KEY ?? null;
  }
}

async function fetchWalletIdentity(
  address: string,
): Promise<WalletIdentity | null> {
  const apiKey = getHeliusApiKeyFromServerRpcUrl();
  if (!apiKey) {
    return null;
  }

  const url = `https://api.helius.xyz/v1/wallet/${address}/identity?api-key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as WalletIdentity;
  return data;
}

export interface PortfolioSummary {
  totalUsd: number;
  stablecoinsUsd: number;
  variableAssetsUsd: number;
  unpricedCount: number;
}

export interface WalletFundingSourceResult {
  funding: WalletFundingSource | null;
  identity: WalletIdentity | null;
}

/**
 * Fetch wallet origin data using Helius funded-by endpoint and identity enrichment.
 *
 * - funding: first incoming SOL transfer source (or null)
 * - identity: optional tag for the funder address (or null)
 */
export async function getWalletFundingSource(
  walletAddress: string,
): Promise<WalletFundingSourceResult> {
  const indexer = getIndexer();
  const funding = await indexer.getWalletFundingSource(walletAddress);

  if (!funding) {
    return { funding: null, identity: null };
  }

  // Prefer identity lookup for the address itself over funderName/funderType fields.
  const identity = await fetchWalletIdentity(funding.funder);
  return { funding, identity };
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

  // Update server caches (fire and forget)
  if (newTxs.length > 0) {
    // Cache at wallet level for pagination
    prependToCache(walletAddress, newTxs).catch((err) =>
      console.error("[Cache] Failed to prepend:", err),
    );
    // Cache at signature level for cross-wallet deduplication
    cacheTransactionsBySignature(newTxs).catch((err) =>
      console.error("[Sig Cache] Failed to cache new txs:", err),
    );
    // Check for new ATAs and invalidate affected caches
    checkAndInvalidateATACache(newTxs, walletAddress).catch((err) =>
      console.error("[ATA Cache] Failed to check/invalidate:", err),
    );
  }

  return newTxs;
}

/**
 * Fetch only balance and portfolio (no transactions)
 * Used for polling when we already have cached transactions
 *
 * Returns enriched balance with full token metadata from:
 * 1. Static registry
 * 2. Jupiter "all" token list
 * 3. Helius DAS (Metaplex on-chain)
 * 4. Fallback (mint prefix)
 */
export async function getBalanceAndPortfolio(walletAddress: string): Promise<{
  balance: EnrichedWalletBalance;
  portfolio: PortfolioSummary;
  nfts: NftAsset[];
  nftCount: number;
}> {
  const indexer = getIndexer();
  const addr = address(walletAddress);

  const rawBalance = await indexer.getBalance(addr);
  const [balance, portfolio, nftResult] = await Promise.all([
    enrichWalletBalance(rawBalance),
    calculatePortfolio(rawBalance),
    getNftsForWallet(walletAddress, 50),
  ]);

  return {
    balance,
    portfolio,
    nfts: nftResult.nfts,
    nftCount: nftResult.total,
  };
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
  metrics?: RequestMetrics; // Performance metrics
}> {
  const { limit = DEFAULT_PAGE_SIZE, cursor, forceRefresh = false } = options;

  // Start tracking metrics (now uses signatures-first approach internally)
  const metrics = startRequestMetrics("signatures-first", walletAddress, limit);

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

      // Record metrics for cache hit
      recordCacheStats(metrics, pageTransactions.length, 0);
      finishRequestMetrics(metrics, pageTransactions.length);

      return {
        transactions: pageTransactions,
        nextCursor,
        hasMore: cached.transactions.length > limit || cached.hasMore,
        fromCache: true,
        cachedLatestSignature: cached.latestSignature, // Client uses this to fetch gap
        metrics,
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

          // Record metrics for cache hit
          recordCacheStats(metrics, pageTransactions.length, 0);
          finishRequestMetrics(metrics, pageTransactions.length);

          return {
            transactions: pageTransactions,
            nextCursor,
            hasMore: cacheHasMore || cached.hasMore,
            fromCache: true,
            cachedLatestSignature: null, // Not needed for pagination
            metrics,
          };
        }
      }
    }
  }

  // Fetch using signatures-first approach with signature-level caching
  const indexer = getIndexer();
  const retryConfig = {
    maxAttempts: 3,
    baseDelayMs: OPTIMIZE_FOR_RATE_LIMITS ? 1000 : 500,
    maxDelayMs: OPTIMIZE_FOR_RATE_LIMITS ? 10000 : 5000,
  };

  // Overfetch to account for spam filtering (2x multiplier, minimum 20)
  const overfetchMultiplier = OPTIMIZE_FOR_RATE_LIMITS ? 1 : 2;
  const fetchLimit = Math.max((limit + 1) * overfetchMultiplier, 20);

  // Step 1: Get signatures (fast, lightweight)
  recordRpcCall(metrics, "signatures", 1); // Wallet signatures
  recordRpcCall(metrics, "tokenAccounts", 2); // TOKEN_PROGRAM + TOKEN_2022_PROGRAM
  recordRpcCall(metrics, "signatures", 5); // Up to 5 ATA signatures

  const sigResult = await indexer.getSignatures(walletAddress, {
    limit: fetchLimit,
    before: cursor ? signature(cursor) : undefined,
    includeTokenAccounts: true,
    maxTokenAccounts: 5,
    retry: retryConfig,
  });

  // Step 2: Fetch transaction details with signature-level cache
  let cacheHits = 0;
  let cacheMisses = 0;

  const transactions = await indexer.getTransactionsBySignatures(
    sigResult.signatures.map((s) => s.signature),
    walletAddress,
    {
      filterSpam: true,
      retry: retryConfig,
      // Check signature cache before fetching from RPC
      getCached: async (sig) => {
        const cached = await getCachedSignature(sig);
        if (cached) {
          cacheHits++;
          return cached;
        }
        cacheMisses++;
        return null;
      },
      // Cache newly fetched transactions
      onFetched: (tx) => {
        recordRpcCall(metrics, "transactions", 1);
        // Fire and forget
        setCachedSignatures([tx]).catch(() => {});
      },
    },
  );

  // Record cache stats
  recordCacheStats(metrics, cacheHits, cacheMisses);

  // After spam filtering, check if we have enough transactions
  // hasMore is true if we got more than the limit OR if the signature result has more
  const hasMore = transactions.length > limit || sigResult.hasMore;
  const pageTransactions = transactions.slice(0, limit);
  const nextCursor =
    pageTransactions.length > 0
      ? (pageTransactions[pageTransactions.length - 1]?.tx.signature ?? null)
      : null;

  console.log(
    `[RPC] Fetched ${pageTransactions.length} txs for ${walletAddress.slice(0, 8)}... (${cacheHits} cache hits, ${cacheMisses} RPC calls, ${transactions.length - pageTransactions.length} filtered)`,
  );

  // Update server caches (fire and forget to not block response)
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

  // Cache at signature level for cross-wallet deduplication
  cacheTransactionsBySignature(pageTransactions).catch((err) =>
    console.error("[Sig Cache] Failed to cache page txs:", err),
  );

  // Check for new ATAs and invalidate affected caches
  checkAndInvalidateATACache(pageTransactions, walletAddress).catch((err) =>
    console.error("[ATA Cache] Failed to check/invalidate:", err),
  );

  // Finish metrics tracking
  finishRequestMetrics(metrics, pageTransactions.length);

  return {
    transactions: pageTransactions,
    nextCursor,
    hasMore,
    fromCache: false,
    cachedLatestSignature: null, // Fresh data, no gap to fill
    metrics,
  };
}

// =============================================================================
// EXPERIMENTAL: Signatures-First API
// =============================================================================

/**
 * @experimental Get transaction signatures for a wallet (lightweight, fast).
 *
 * This returns only signature metadata without fetching full transaction details.
 * Use this for:
 * - Initial page load (show list immediately)
 * - Pagination (get next batch of signatures)
 * - Checking what transactions exist before loading details
 *
 * Follow up with `getTransactionDetails()` to load full classified transactions.
 */
export async function getSignatures(
  walletAddress: string,
  options: {
    limit?: number;
    cursor?: string;
    includeTokenAccounts?: boolean;
  } = {},
): Promise<GetSignaturesResult> {
  const {
    limit = DEFAULT_PAGE_SIZE,
    cursor,
    includeTokenAccounts = true,
  } = options;

  const indexer = getIndexer();
  const retryConfig = {
    maxAttempts: 3,
    baseDelayMs: OPTIMIZE_FOR_RATE_LIMITS ? 1000 : 500,
    maxDelayMs: OPTIMIZE_FOR_RATE_LIMITS ? 10000 : 5000,
  };

  const result = await indexer.getSignatures(walletAddress, {
    limit,
    before: cursor ? signature(cursor) : undefined,
    includeTokenAccounts,
    maxTokenAccounts: 5,
    retry: retryConfig,
  });

  console.log(
    `[Signatures-First] Got ${result.signatures.length} signatures for ${walletAddress.slice(0, 8)}...`,
  );

  return result;
}

/**
 * @experimental Fetch classified transaction details for specific signatures.
 *
 * Integrates with the signature cache to avoid redundant RPC calls.
 * Only fetches transactions that aren't already cached.
 *
 * @returns Object with transactions and cache hit statistics
 */
export async function getTransactionDetails(
  walletAddress: string,
  signatures: string[],
  options: {
    filterSpam?: boolean;
    metrics?: RequestMetrics; // Optional metrics to track
  } = {},
): Promise<{
  transactions: ClassifiedTransaction[];
  cacheHits: number;
  cacheMisses: number;
}> {
  const { filterSpam = true, metrics } = options;

  if (signatures.length === 0) {
    return { transactions: [], cacheHits: 0, cacheMisses: 0 };
  }

  const indexer = getIndexer();
  let cacheHits = 0;
  let cacheMisses = 0;

  const retryConfig = {
    maxAttempts: 3,
    baseDelayMs: OPTIMIZE_FOR_RATE_LIMITS ? 1000 : 500,
    maxDelayMs: OPTIMIZE_FOR_RATE_LIMITS ? 10000 : 5000,
  };

  const transactions = await indexer.getTransactionsBySignatures(
    signatures,
    walletAddress,
    {
      filterSpam,
      retry: retryConfig,
      // Check signature cache before fetching from RPC
      getCached: async (sig) => {
        const cached = await getCachedSignature(sig);
        if (cached) {
          cacheHits++;
          return cached;
        }
        cacheMisses++;
        return null;
      },
      // Cache newly fetched transactions
      onFetched: (tx) => {
        // Track RPC call for transaction fetch
        if (metrics) {
          recordRpcCall(metrics, "transactions", 1);
        }
        // Fire and forget - don't block the response
        setCachedSignatures([tx]).catch((err) =>
          console.error("[Sig Cache] Failed to cache:", err),
        );
      },
    },
  );

  // Record cache stats
  if (metrics) {
    recordCacheStats(metrics, cacheHits, cacheMisses);
  }

  console.log(
    `[Signatures-First] Loaded ${transactions.length} txs for ${walletAddress.slice(0, 8)}... (${cacheHits} cache hits, ${cacheMisses} RPC calls)`,
  );

  // Check for new ATAs and invalidate affected caches
  if (transactions.length > 0) {
    checkAndInvalidateATACache(transactions, walletAddress).catch((err) =>
      console.error("[ATA Cache] Failed to check/invalidate:", err),
    );
  }

  return {
    transactions,
    cacheHits,
    cacheMisses,
  };
}

/**
 * @experimental Get a page of transactions using signatures-first approach.
 *
 * This combines getSignatures() + getTransactionDetails() in a single call,
 * providing both the efficiency benefits and a simple API.
 *
 * Returns:
 * - transactions: Full classified transactions
 * - signatures: Lightweight signature metadata (for UI before details load)
 * - hasMore: Whether there are more pages
 * - nextCursor: Cursor for the next page
 * - stats: Cache hit/miss statistics
 */
export async function getTransactionsPageSignaturesFirst(
  walletAddress: string,
  options: {
    limit?: number;
    cursor?: string;
    includeTokenAccounts?: boolean;
  } = {},
): Promise<{
  transactions: ClassifiedTransaction[];
  signatures: SignatureInfo[];
  hasMore: boolean;
  nextCursor: string | null;
  stats: {
    cacheHits: number;
    cacheMisses: number;
  };
  metrics?: RequestMetrics;
}> {
  const {
    limit = DEFAULT_PAGE_SIZE,
    cursor,
    includeTokenAccounts = true,
  } = options;

  // Start tracking metrics
  const metrics = startRequestMetrics("signatures-first", walletAddress, limit);

  // Step 1: Get signatures (fast, lightweight)
  // Track RPC calls: getSignaturesForAddress (1) + optionally token accounts
  recordRpcCall(metrics, "signatures", 1);
  if (includeTokenAccounts) {
    recordRpcCall(metrics, "tokenAccounts", 2); // TOKEN_PROGRAM + TOKEN_2022
    recordRpcCall(metrics, "signatures", 5); // Up to 5 ATAs
  }

  const sigResult = await getSignatures(walletAddress, {
    limit,
    cursor,
    includeTokenAccounts,
  });

  // Step 2: Fetch transaction details with cache integration
  const detailsResult = await getTransactionDetails(
    walletAddress,
    sigResult.signatures.map((s) => s.signature),
    { metrics }, // Pass metrics for tracking
  );

  // Update wallet-level cache for backwards compatibility
  if (detailsResult.transactions.length > 0 && !cursor) {
    setCachedTransactions(
      walletAddress,
      detailsResult.transactions,
      sigResult.hasMore,
    ).catch((err) => console.error("[Cache] Failed to set:", err));
  } else if (detailsResult.transactions.length > 0 && cursor) {
    appendToCache(
      walletAddress,
      detailsResult.transactions,
      sigResult.hasMore,
    ).catch((err) => console.error("[Cache] Failed to append:", err));
  }

  // Finish metrics tracking
  finishRequestMetrics(metrics, detailsResult.transactions.length);

  return {
    transactions: detailsResult.transactions,
    signatures: sigResult.signatures,
    hasMore: sigResult.hasMore,
    nextCursor: sigResult.oldestSignature,
    stats: {
      cacheHits: detailsResult.cacheHits,
      cacheMisses: detailsResult.cacheMisses,
    },
    metrics,
  };
}

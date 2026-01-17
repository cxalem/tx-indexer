"use client";

/**
 * EXPERIMENTAL: Signatures-First Transaction Feed Hook
 *
 * This hook uses the new signatures-first API for more efficient
 * transaction loading with better cache utilization.
 *
 * Benefits:
 * - Faster initial load (signatures are lightweight)
 * - Better cache hit rates (signature-level caching)
 * - Lower RPC usage (skip cached transactions)
 * - Supports on-demand detail loading
 */

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  getSignatures,
  getTransactionDetails,
  getNewTransactions,
} from "@/app/actions/dashboard";
import type { ClassifiedTransaction, SignatureInfo } from "tx-indexer";
import {
  STATEMENT_WINDOW_MS,
  DEFAULT_PAGE_SIZE,
  FAST_STALE_TIME_MS,
  TRANSACTION_FEED_STALE_TIME_MS,
  EMPTY_TRANSACTIONS_FEED_QUERY_KEY,
} from "@/lib/constants";

// =============================================================================
// Query Keys
// =============================================================================

export const signaturesFirstKeys = {
  all: ["signatures-first"] as const,
  signatures: (address: string) =>
    [...signaturesFirstKeys.all, "signatures", address] as const,
  transactions: (address: string) =>
    [...signaturesFirstKeys.all, "transactions", address] as const,
};

// =============================================================================
// Types
// =============================================================================

export type OnNewTransactionsCallback = (
  transactions: ClassifiedTransaction[],
) => void;

interface UseSignaturesFirstFeedOptions {
  pageSize?: number;
  fastPolling?: boolean;
  onNewTransactions?: OnNewTransactionsCallback;
  /** If true, automatically load transaction details. If false, only load signatures initially. */
  autoLoadDetails?: boolean;
}

interface SignaturesPage {
  signatures: SignatureInfo[];
  transactions: ClassifiedTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
  reachedStatementCutoff: boolean;
  stats: {
    cacheHits: number;
    cacheMisses: number;
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useSignaturesFirstFeed(
  address: string | null,
  options: UseSignaturesFirstFeedOptions = {},
) {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    fastPolling = false,
    onNewTransactions,
    autoLoadDetails = true,
  } = options;

  const queryClient = useQueryClient();

  // Track which signatures we've seen (for new transaction detection)
  const polledSignaturesRef = useRef<Set<string>>(new Set());
  const [newSignatures, setNewSignatures] = useState<Set<string>>(new Set());
  const [isCheckingForNew, setIsCheckingForNew] = useState(false);
  const isInitializedRef = useRef(false);
  const lastCheckedGapSignatureRef = useRef<string | null>(null);

  // Cache stats
  const [totalCacheHits, setTotalCacheHits] = useState(0);
  const [totalCacheMisses, setTotalCacheMisses] = useState(0);

  // Statement window cutoff
  const statementCutoffTimestamp = useMemo(() => {
    const now = Date.now();
    return Math.floor((now - STATEMENT_WINDOW_MS) / 1000);
  }, []);

  // ==========================================================================
  // Main Query: Signatures + Transactions
  // ==========================================================================

  const query = useInfiniteQuery<SignaturesPage>({
    queryKey: address
      ? signaturesFirstKeys.signatures(address)
      : EMPTY_TRANSACTIONS_FEED_QUERY_KEY,
    queryFn: async ({ pageParam }) => {
      if (!address) {
        return {
          signatures: [],
          transactions: [],
          nextCursor: null,
          hasMore: false,
          reachedStatementCutoff: false,
          stats: { cacheHits: 0, cacheMisses: 0 },
        };
      }

      const cursor = pageParam as string | undefined;

      // Step 1: Get signatures (fast)
      const sigResult = await getSignatures(address, {
        limit: pageSize,
        cursor,
        includeTokenAccounts: true,
      });

      // Filter signatures by statement window
      let reachedStatementCutoff = false;
      const filteredSignatures: SignatureInfo[] = [];

      for (const sig of sigResult.signatures) {
        const blockTime = sig.blockTime ? Number(sig.blockTime) : null;
        if (blockTime && blockTime < statementCutoffTimestamp) {
          reachedStatementCutoff = true;
          break;
        }
        filteredSignatures.push(sig);
      }

      // Step 2: Load transaction details if enabled
      let transactions: ClassifiedTransaction[] = [];
      let stats = { cacheHits: 0, cacheMisses: 0 };

      if (autoLoadDetails && filteredSignatures.length > 0) {
        const detailsResult = await getTransactionDetails(
          address,
          filteredSignatures.map((s) => s.signature),
        );
        transactions = detailsResult.transactions;
        stats = {
          cacheHits: detailsResult.cacheHits,
          cacheMisses: detailsResult.cacheMisses,
        };

        // Update cumulative stats
        setTotalCacheHits((prev) => prev + stats.cacheHits);
        setTotalCacheMisses((prev) => prev + stats.cacheMisses);
      }

      // Log in development
      if (process.env.NODE_ENV === "development") {
        const cacheRate =
          stats.cacheHits + stats.cacheMisses > 0
            ? Math.round(
                (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100,
              )
            : 0;
        console.log(
          `[Signatures-First] ${filteredSignatures.length} sigs, ${transactions.length} txs (${cacheRate}% cache hit)`,
        );
      }

      return {
        signatures: filteredSignatures,
        transactions,
        nextCursor: reachedStatementCutoff ? null : sigResult.oldestSignature,
        hasMore: !reachedStatementCutoff && sigResult.hasMore,
        reachedStatementCutoff,
        stats,
      };
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.reachedStatementCutoff) {
        return undefined;
      }
      return lastPage.nextCursor;
    },
    enabled: !!address,
    staleTime: fastPolling
      ? FAST_STALE_TIME_MS
      : TRANSACTION_FEED_STALE_TIME_MS,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // ==========================================================================
  // Derived Data
  // ==========================================================================

  const allSignatures = useMemo(() => {
    if (!query.data?.pages) return [];
    const sigs: SignatureInfo[] = [];
    const seen = new Set<string>();

    for (const page of query.data.pages) {
      for (const sig of page.signatures) {
        if (!seen.has(sig.signature)) {
          seen.add(sig.signature);
          sigs.push(sig);
        }
      }
    }

    return sigs;
  }, [query.data?.pages]);

  const allTransactions = useMemo(() => {
    if (!query.data?.pages) return [];
    const txs: ClassifiedTransaction[] = [];
    const seen = new Set<string>();

    for (const page of query.data.pages) {
      for (const tx of page.transactions) {
        const sig = String(tx.tx.signature);
        if (!seen.has(sig)) {
          seen.add(sig);
          txs.push(tx);
        }
      }
    }

    return txs;
  }, [query.data?.pages]);

  const reachedStatementCutoff = useMemo(() => {
    if (!query.data?.pages) return false;
    return query.data.pages.some((page) => page.reachedStatementCutoff);
  }, [query.data?.pages]);

  const hasMore = useMemo(() => {
    if (!query.data?.pages || query.data.pages.length === 0) return true;
    const lastPage = query.data.pages[query.data.pages.length - 1];
    return lastPage
      ? lastPage.hasMore && !lastPage.reachedStatementCutoff
      : false;
  }, [query.data?.pages]);

  // ==========================================================================
  // Initialize polled signatures tracking
  // ==========================================================================

  useEffect(() => {
    if (
      !isInitializedRef.current &&
      allSignatures.length > 0 &&
      !query.isLoading
    ) {
      for (const sig of allSignatures) {
        polledSignaturesRef.current.add(sig.signature);
      }
      isInitializedRef.current = true;
    }
  }, [allSignatures, query.isLoading]);

  // ==========================================================================
  // Poll for New Transactions
  // ==========================================================================

  const pollNewTransactions = useCallback(async () => {
    if (!address || allSignatures.length === 0) return;

    const latestSig = allSignatures[0]?.signature;
    if (!latestSig) return;

    try {
      setIsCheckingForNew(true);
      const newTxs = await getNewTransactions(address, latestSig, pageSize);

      if (newTxs.length === 0) {
        setIsCheckingForNew(false);
        return;
      }

      const trulyNewSigs = new Set<string>();
      for (const tx of newTxs) {
        const sig = String(tx.tx.signature);
        if (!polledSignaturesRef.current.has(sig)) {
          trulyNewSigs.add(sig);
          polledSignaturesRef.current.add(sig);
        }
      }

      if (trulyNewSigs.size > 0) {
        setNewSignatures(trulyNewSigs);
        setTimeout(() => setNewSignatures(new Set()), 3000);

        const trulyNewTxs = newTxs.filter((tx) =>
          trulyNewSigs.has(String(tx.tx.signature)),
        );

        if (onNewTransactions && trulyNewTxs.length > 0) {
          onNewTransactions(trulyNewTxs);
        }

        // Prepend to query data
        queryClient.setQueryData<{
          pages: SignaturesPage[];
          pageParams: unknown[];
        }>(signaturesFirstKeys.signatures(address), (oldData) => {
          if (!oldData?.pages || !oldData.pages[0]) return oldData;

          const newSignatureInfos: SignatureInfo[] = trulyNewTxs.map((tx) => ({
            signature: String(tx.tx.signature),
            slot:
              typeof tx.tx.slot === "bigint" ? tx.tx.slot : BigInt(tx.tx.slot),
            blockTime: tx.tx.blockTime
              ? typeof tx.tx.blockTime === "bigint"
                ? tx.tx.blockTime
                : BigInt(tx.tx.blockTime)
              : null,
            err: tx.tx.err,
            memo: tx.tx.memo ?? null,
          }));

          const newPage: SignaturesPage = {
            ...oldData.pages[0],
            signatures: [...newSignatureInfos, ...oldData.pages[0].signatures],
            transactions: [...trulyNewTxs, ...oldData.pages[0].transactions],
          };

          return {
            ...oldData,
            pages: [newPage, ...oldData.pages.slice(1)],
          };
        });
      }
    } catch (error) {
      console.error("Failed to poll new transactions:", error);
    } finally {
      setIsCheckingForNew(false);
    }
  }, [address, allSignatures, pageSize, queryClient, onNewTransactions]);

  // ==========================================================================
  // Load Details for Specific Signatures
  // ==========================================================================

  const loadDetailsForSignatures = useCallback(
    async (signatures: string[]): Promise<ClassifiedTransaction[]> => {
      if (!address || signatures.length === 0) return [];

      try {
        const result = await getTransactionDetails(address, signatures);
        setTotalCacheHits((prev) => prev + result.cacheHits);
        setTotalCacheMisses((prev) => prev + result.cacheMisses);
        return result.transactions;
      } catch (error) {
        console.error("Failed to load transaction details:", error);
        return [];
      }
    },
    [address],
  );

  // ==========================================================================
  // Refresh
  // ==========================================================================

  const refresh = useCallback(
    async (forceFullRefresh = false) => {
      if (!address) return;

      if (forceFullRefresh) {
        isInitializedRef.current = false;
        polledSignaturesRef.current.clear();
        setTotalCacheHits(0);
        setTotalCacheMisses(0);
        await queryClient.invalidateQueries({
          queryKey: signaturesFirstKeys.signatures(address),
        });
      } else {
        await pollNewTransactions();
      }
    },
    [address, queryClient, pollNewTransactions],
  );

  // ==========================================================================
  // Load More
  // ==========================================================================

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // Data
    signatures: allSignatures,
    transactions: allTransactions,
    newSignatures,

    // Loading states
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isCheckingForNew,

    // Pagination
    hasMore,
    reachedStatementCutoff,
    loadMore,

    // Actions
    refresh,
    pollNewTransactions,
    loadDetailsForSignatures,

    // Stats
    cacheStats: {
      hits: totalCacheHits,
      misses: totalCacheMisses,
      hitRate:
        totalCacheHits + totalCacheMisses > 0
          ? totalCacheHits / (totalCacheHits + totalCacheMisses)
          : 0,
    },

    // Query error
    error: query.error,
  };
}

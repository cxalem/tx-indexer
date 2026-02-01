"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  getTransactionsPage,
  getNewTransactions,
} from "@/app/actions/dashboard";
import type { ClassifiedTransaction } from "tx-indexer";
import {
  STATEMENT_WINDOW_MS,
  STATEMENT_WINDOW_DAYS,
  DEFAULT_PAGE_SIZE,
  FAST_STALE_TIME_MS,
  TRANSACTION_FEED_STALE_TIME_MS,
  EMPTY_TRANSACTIONS_FEED_QUERY_KEY,
} from "@/lib/constants";

export const transactionsFeedKeys = {
  all: ["transactions-feed"] as const,
  feed: (address: string) =>
    [...transactionsFeedKeys.all, "feed", address] as const,
};

export type OnNewTransactionsCallback = (
  transactions: ClassifiedTransaction[],
) => void;

interface UseTransactionsFeedOptions {
  pageSize?: number;
  fastPolling?: boolean;
  onNewTransactions?: OnNewTransactionsCallback;
  /** Custom statement window in days (defaults to STATEMENT_WINDOW_DAYS) */
  statementWindowDays?: number;
}

interface TransactionsFeedPage {
  transactions: ClassifiedTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
  reachedStatementCutoff: boolean;
  fromCache?: boolean;
  cachedLatestSignature?: string | null;
}

export function useTransactionsFeed(
  address: string | null,
  options: UseTransactionsFeedOptions = {},
) {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    fastPolling = false,
    onNewTransactions,
    statementWindowDays = STATEMENT_WINDOW_DAYS,
  } = options;
  const queryClient = useQueryClient();

  const polledSignaturesRef = useRef<Set<string>>(new Set());
  const [newSignatures, setNewSignatures] = useState<Set<string>>(new Set());
  const [isCheckingForNew, setIsCheckingForNew] = useState(false);
  const [isFillingGap, setIsFillingGap] = useState(false);
  const [gapFillProgress, setGapFillProgress] = useState<{
    fetched: number;
    hasMore: boolean;
  } | null>(null);
  const isInitializedRef = useRef(false);
  const lastCheckedGapSignatureRef = useRef<string | null>(null);

  const statementCutoffTimestamp = useMemo(() => {
    const now = Date.now();
    const windowMs = statementWindowDays * 24 * 60 * 60 * 1000;
    return Math.floor((now - windowMs) / 1000);
  }, [statementWindowDays]);

  const query = useInfiniteQuery<TransactionsFeedPage>({
    queryKey: address
      ? transactionsFeedKeys.feed(address)
      : EMPTY_TRANSACTIONS_FEED_QUERY_KEY,
    queryFn: async ({ pageParam }) => {
      if (!address) {
        return {
          transactions: [],
          nextCursor: null,
          hasMore: false,
          reachedStatementCutoff: false,
          fromCache: false,
        };
      }

      const cursor = pageParam as string | undefined;

      const result = await getTransactionsPage(address, {
        limit: pageSize,
        cursor,
      });

      // Log cache status in development
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[Transactions] ${result.fromCache ? "FROM CACHE" : "FROM RPC"} - ${result.transactions.length} transactions`,
        );
      }

      let reachedStatementCutoff = false;
      const filteredTransactions: ClassifiedTransaction[] = [];

      for (const tx of result.transactions) {
        const blockTime = tx.tx.blockTime ? Number(tx.tx.blockTime) : null;

        if (blockTime && blockTime < statementCutoffTimestamp) {
          reachedStatementCutoff = true;
          break;
        }

        filteredTransactions.push(tx);
      }

      return {
        transactions: filteredTransactions,
        nextCursor: reachedStatementCutoff ? null : result.nextCursor,
        hasMore: !reachedStatementCutoff && result.hasMore,
        reachedStatementCutoff,
        fromCache: result.fromCache,
        cachedLatestSignature: result.cachedLatestSignature,
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
    // Longer stale time - we rely on polling for new transactions
    staleTime: fastPolling
      ? FAST_STALE_TIME_MS
      : TRANSACTION_FEED_STALE_TIME_MS,
    // Keep previous data while refetching for instant display
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    // Don't refetch on mount if we have data - polling handles updates
    refetchOnMount: false,
  });

  const allTransactions = useMemo(() => {
    if (!query.data?.pages) return [];

    const transactions: ClassifiedTransaction[] = [];
    const seen = new Set<string>();

    for (const page of query.data.pages) {
      for (const tx of page.transactions) {
        if (!seen.has(tx.tx.signature)) {
          seen.add(tx.tx.signature);
          transactions.push(tx);
        }
      }
    }

    return transactions;
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

  // Initialize polled signatures when we first load transactions
  // Using useEffect to avoid side effects during render
  useEffect(() => {
    if (
      !isInitializedRef.current &&
      allTransactions.length > 0 &&
      !query.isLoading
    ) {
      for (const tx of allTransactions) {
        polledSignaturesRef.current.add(tx.tx.signature);
      }
      isInitializedRef.current = true;
    }
  }, [allTransactions, query.isLoading]);

  // Check if we got cached data and need to fetch the gap
  const firstPage = query.data?.pages?.[0];
  const cachedLatestSignature = firstPage?.cachedLatestSignature;
  const wasFromCache = firstPage?.fromCache;

  /**
   * Fetch gap between cached data and current state.
   * Handles large gaps by continuing to fetch until caught up.
   */
  const fetchGapTransactions = useCallback(
    async (untilSignature: string, isWindowFocus = false) => {
      if (!address) return;

      // Only skip if we've already checked THIS specific signature
      // (allows re-checking when cache updates or on focus)
      if (
        !isWindowFocus &&
        lastCheckedGapSignatureRef.current === untilSignature
      ) {
        return;
      }

      lastCheckedGapSignatureRef.current = untilSignature;
      setIsFillingGap(true);
      setIsCheckingForNew(true);
      setGapFillProgress({ fetched: 0, hasMore: true });

      if (process.env.NODE_ENV === "development") {
        console.log(
          `[Transactions] ${isWindowFocus ? "(Focus) " : ""}Checking for new transactions since ${untilSignature.slice(0, 8)}...`,
        );
      }

      try {
        let currentUntil = untilSignature;
        let totalFetched = 0;
        let allNewTxs: ClassifiedTransaction[] = [];
        const maxIterations = 5; // Safety limit for large gaps
        let iteration = 0;

        // Fetch in batches until we're caught up or hit the limit
        while (iteration < maxIterations) {
          iteration++;
          const newTxs = await getNewTransactions(
            address,
            currentUntil,
            pageSize,
          );

          if (newTxs.length === 0) {
            break; // No more transactions to fetch
          }

          allNewTxs = [...allNewTxs, ...newTxs];
          totalFetched += newTxs.length;
          setGapFillProgress({ fetched: totalFetched, hasMore: true });

          // If we got fewer than pageSize, we're caught up
          if (newTxs.length < pageSize) {
            break;
          }

          // Update cursor to continue fetching
          const oldestFetched = newTxs[newTxs.length - 1];
          if (oldestFetched) {
            currentUntil = oldestFetched.tx.signature;
          } else {
            break;
          }
        }

        setGapFillProgress({ fetched: totalFetched, hasMore: false });

        if (allNewTxs.length > 0) {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `[Transactions] Found ${allNewTxs.length} new transactions in gap!`,
            );
          }

          // Track new signatures for animation
          const trulyNewSigs = new Set<string>();
          for (const tx of allNewTxs) {
            if (!polledSignaturesRef.current.has(tx.tx.signature)) {
              trulyNewSigs.add(tx.tx.signature);
              polledSignaturesRef.current.add(tx.tx.signature);
            }
          }

          if (trulyNewSigs.size > 0) {
            setNewSignatures(trulyNewSigs);
            setTimeout(() => setNewSignatures(new Set()), 3000);

            // Notify callback
            const trulyNewTxs = allNewTxs.filter((tx) =>
              trulyNewSigs.has(tx.tx.signature),
            );
            if (onNewTransactions && trulyNewTxs.length > 0) {
              onNewTransactions(trulyNewTxs);
            }

            // Prepend to query data
            queryClient.setQueryData<{
              pages: TransactionsFeedPage[];
              pageParams: unknown[];
            }>(transactionsFeedKeys.feed(address), (oldData) => {
              if (!oldData?.pages || !oldData.pages[0]) return oldData;

              const newPage = {
                ...oldData.pages[0],
                transactions: [
                  ...trulyNewTxs,
                  ...oldData.pages[0].transactions,
                ],
                // Clear the flag so we don't re-fetch
                cachedLatestSignature: null,
              };

              return {
                ...oldData,
                pages: [newPage, ...oldData.pages.slice(1)],
              };
            });
          }
        } else {
          if (process.env.NODE_ENV === "development") {
            console.log("[Transactions] No new transactions found");
          }
        }
      } catch (error) {
        console.error("Failed to fetch transaction gap:", error);
      } finally {
        setIsCheckingForNew(false);
        setIsFillingGap(false);
        setGapFillProgress(null);
      }
    },
    [address, pageSize, queryClient, onNewTransactions],
  );

  // Fetch gap when we get cached data
  useEffect(() => {
    if (!address || !wasFromCache || !cachedLatestSignature) {
      return;
    }

    fetchGapTransactions(cachedLatestSignature);
  }, [address, wasFromCache, cachedLatestSignature, fetchGapTransactions]);

  // Re-check gap on window focus
  useEffect(() => {
    if (!address || !cachedLatestSignature) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && cachedLatestSignature) {
        // Re-check for new transactions when tab becomes visible
        fetchGapTransactions(cachedLatestSignature, true);
      }
    };

    const handleWindowFocus = () => {
      if (cachedLatestSignature) {
        fetchGapTransactions(cachedLatestSignature, true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [address, cachedLatestSignature, fetchGapTransactions]);

  const pollNewTransactions = useCallback(async () => {
    if (!address || allTransactions.length === 0) return;

    const latestSig = allTransactions[0]?.tx.signature;
    if (!latestSig) return;

    try {
      const newTxs = await getNewTransactions(address, latestSig, pageSize);

      if (newTxs.length === 0) return;

      const trulyNewSigs = new Set<string>();
      for (const tx of newTxs) {
        if (!polledSignaturesRef.current.has(tx.tx.signature)) {
          trulyNewSigs.add(tx.tx.signature);
          polledSignaturesRef.current.add(tx.tx.signature);
        }
      }

      if (trulyNewSigs.size > 0) {
        setNewSignatures(trulyNewSigs);
        setTimeout(() => setNewSignatures(new Set()), 3000);

        // Get the truly new transactions for notification callback
        const trulyNewTxs = newTxs.filter((tx) =>
          trulyNewSigs.has(tx.tx.signature),
        );

        // Call the notification callback if provided
        if (onNewTransactions && trulyNewTxs.length > 0) {
          onNewTransactions(trulyNewTxs);
        }

        queryClient.setQueryData<{
          pages: TransactionsFeedPage[];
          pageParams: unknown[];
        }>(transactionsFeedKeys.feed(address), (oldData) => {
          if (!oldData?.pages || !oldData.pages[0]) return oldData;

          const newPage = {
            ...oldData.pages[0],
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
    }
  }, [address, allTransactions, pageSize, queryClient, onNewTransactions]);

  /**
   * Smart refresh - polls for new transactions instead of full reload.
   * Only does a full reload if forceFullRefresh is true.
   */
  const refresh = useCallback(
    async (forceFullRefresh = false) => {
      if (!address) return;

      if (forceFullRefresh) {
        // Full reload - clears cache and refetches everything
        isInitializedRef.current = false;
        polledSignaturesRef.current.clear();
        await queryClient.invalidateQueries({
          queryKey: transactionsFeedKeys.feed(address),
        });
      } else {
        // Smart refresh - just poll for new transactions
        // This is instant if there are no new transactions
        await pollNewTransactions();
      }
    },
    [address, queryClient, pollNewTransactions],
  );

  const {
    fetchNextPage,
    hasNextPage: queryHasNextPage,
    isFetchingNextPage: queryIsFetchingNextPage,
  } = query;

  const loadMore = useCallback(() => {
    if (queryHasNextPage && !queryIsFetchingNextPage) {
      fetchNextPage();
    }
  }, [queryHasNextPage, queryIsFetchingNextPage, fetchNextPage]);

  return {
    transactions: allTransactions,
    newSignatures,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isCheckingForNew, // True when fetching gap after cache hit
    isFillingGap, // True when filling a large gap (multiple pages)
    gapFillProgress, // Progress info when filling a large gap
    hasMore,
    reachedStatementCutoff,
    error: query.error,
    loadMore,
    refresh,
    pollNewTransactions,
    fetchGapTransactions, // Manual gap fill trigger
  };
}

export interface DailyTotal {
  netAmount: number;
  isPositive: boolean;
  symbol: string;
}

export interface TransactionsByDay {
  date: Date;
  dateKey: string;
  displayDate: string;
  transactions: ClassifiedTransaction[];
  dailyTotal: DailyTotal | null;
}

export function groupTransactionsByDay(
  transactions: ClassifiedTransaction[],
  walletAddress: string,
): TransactionsByDay[] {
  const groups = new Map<string, TransactionsByDay>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const tx of transactions) {
    const blockTime = tx.tx.blockTime ? Number(tx.tx.blockTime) : null;
    if (!blockTime) continue;

    const date = new Date(blockTime * 1000);
    const dayStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const dateKey = dayStart.toISOString().split("T")[0] ?? "";

    if (!groups.has(dateKey)) {
      let displayDate: string;

      if (dayStart.getTime() === today.getTime()) {
        displayDate = "Today";
      } else if (dayStart.getTime() === yesterday.getTime()) {
        displayDate = "Yesterday";
      } else {
        displayDate = new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
        }).format(dayStart);
      }

      groups.set(dateKey, {
        date: dayStart,
        dateKey,
        displayDate,
        transactions: [],
        dailyTotal: null,
      });
    }

    groups.get(dateKey)!.transactions.push(tx);
  }

  for (const group of groups.values()) {
    group.dailyTotal = calculateDailyTotal(group.transactions, walletAddress);
  }

  return Array.from(groups.values()).toSorted(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}

function calculateDailyTotal(
  transactions: ClassifiedTransaction[],
  walletAddress: string,
): DailyTotal | null {
  const totals = new Map<string, number>();
  const wallet = walletAddress.toLowerCase();

  for (const tx of transactions) {
    const { classification } = tx;
    const sender = classification.sender?.toLowerCase();
    const receiver = classification.receiver?.toLowerCase();
    const amount = classification.primaryAmount;

    if (!amount) continue;

    const symbol = amount.token.symbol;
    const currentTotal = totals.get(symbol) ?? 0;

    if (classification.primaryType === "swap") {
      continue;
    }

    if (sender === wallet && receiver !== wallet) {
      totals.set(symbol, currentTotal - amount.amountUi);
    } else if (receiver === wallet && sender !== wallet) {
      totals.set(symbol, currentTotal + amount.amountUi);
    }
  }

  let largestSymbol = "";
  let largestAbsValue = 0;

  for (const [symbol, value] of totals) {
    const absValue = Math.abs(value);
    if (absValue > largestAbsValue) {
      largestAbsValue = absValue;
      largestSymbol = symbol;
    }
  }

  if (!largestSymbol || largestAbsValue === 0) {
    return null;
  }

  const netAmount = totals.get(largestSymbol) ?? 0;

  return {
    netAmount,
    isPositive: netAmount >= 0,
    symbol: largestSymbol,
  };
}

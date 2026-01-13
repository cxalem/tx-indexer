"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  getTransactionsPage,
  getNewTransactions,
} from "@/app/actions/dashboard";
import type { ClassifiedTransaction } from "tx-indexer";

const STATEMENT_WINDOW_DAYS = 31;
const STATEMENT_WINDOW_MS = STATEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

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
}

interface TransactionsFeedPage {
  transactions: ClassifiedTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
  reachedStatementCutoff: boolean;
}

export function useTransactionsFeed(
  address: string | null,
  options: UseTransactionsFeedOptions = {},
) {
  const { pageSize = 10, fastPolling = false, onNewTransactions } = options;
  const queryClient = useQueryClient();

  const polledSignaturesRef = useRef<Set<string>>(new Set());
  const [newSignatures, setNewSignatures] = useState<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  const statementCutoffTimestamp = useMemo(() => {
    const now = Date.now();
    return Math.floor((now - STATEMENT_WINDOW_MS) / 1000);
  }, []);

  const query = useInfiniteQuery<TransactionsFeedPage>({
    queryKey: address
      ? transactionsFeedKeys.feed(address)
      : ["transactions-feed", "empty"],
    queryFn: async ({ pageParam }) => {
      if (!address) {
        return {
          transactions: [],
          nextCursor: null,
          hasMore: false,
          reachedStatementCutoff: false,
        };
      }

      const cursor = pageParam as string | undefined;

      const result = await getTransactionsPage(address, {
        limit: pageSize,
        cursor,
      });

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
    staleTime: fastPolling ? 5 * 1000 : 30 * 1000,
    refetchOnWindowFocus: false,
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

  const refresh = useCallback(async () => {
    if (!address) return;

    isInitializedRef.current = false;
    polledSignaturesRef.current.clear();

    await queryClient.invalidateQueries({
      queryKey: transactionsFeedKeys.feed(address),
    });
  }, [address, queryClient]);

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
    hasMore,
    reachedStatementCutoff,
    error: query.error,
    loadMore,
    refresh,
    pollNewTransactions,
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

  return Array.from(groups.values()).sort(
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

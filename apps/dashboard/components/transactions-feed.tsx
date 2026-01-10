"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import type { ClassifiedTransaction } from "tx-indexer";
import { TransactionRow } from "@/components/transaction-row";
import { TransactionRowSkeleton } from "@/components/skeletons";
import {
  useTransactionsFeed,
  groupTransactionsByDay,
  type DailyTotal,
} from "@/hooks/use-transactions-feed";
import { cn } from "@/lib/utils";
import { Inbox, RefreshCw, Clock, Loader2 } from "lucide-react";
import localFont from "next/font/local";

const bitcountFont = localFont({
  src: "../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

interface TransactionsFeedProps {
  walletAddress: string;
  fastPolling?: boolean;
}

export function TransactionsFeed({
  walletAddress,
  fastPolling = false,
}: TransactionsFeedProps) {
  const {
    transactions,
    newSignatures,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasMore,
    reachedStatementCutoff,
    loadMore,
    refresh,
    pollNewTransactions,
  } = useTransactionsFeed(walletAddress, {
    pageSize: 10,
    fastPolling,
  });

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pollingInterval = fastPolling ? 10 * 1000 : 60 * 1000;

    pollingIntervalRef.current = setInterval(() => {
      pollNewTransactions();
    }, pollingInterval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fastPolling, pollNewTransactions]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && hasMore && !isFetchingNextPage) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isFetchingNextPage, loadMore]);

  const transactionsByDay = useMemo(
    () => groupTransactionsByDay(transactions, walletAddress),
    [transactions, walletAddress]
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  if (isLoading) {
    return (
      <div>
        <FeedHeader onRefresh={handleRefresh} isRefreshing={false} />
        <div className="space-y-4">
          <DayGroupSkeleton />
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div>
        <FeedHeader onRefresh={handleRefresh} isRefreshing={isFetching} />
        <div className="border border-neutral-200 rounded-lg bg-white p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-100 mx-auto mb-4 flex items-center justify-center">
            <Inbox className="h-6 w-6 text-neutral-400" />
          </div>
          <p className="text-neutral-600 mb-1">no transactions found</p>
          <p className="text-sm text-neutral-400">
            your recent activity will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <FeedHeader onRefresh={handleRefresh} isRefreshing={isFetching} />

      <div className="space-y-4">
        {transactionsByDay.map((dayGroup) => (
          <DayGroup
            key={dayGroup.dateKey}
            displayDate={dayGroup.displayDate}
            dailyTotal={dayGroup.dailyTotal}
            transactions={dayGroup.transactions}
            walletAddress={walletAddress}
            newSignatures={newSignatures}
          />
        ))}

        <div ref={loadMoreRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4 gap-2 text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading more...</span>
          </div>
        )}

        {reachedStatementCutoff && <StatementCutoffFooter />}

        {!hasMore && !reachedStatementCutoff && transactions.length > 0 && (
          <div className="py-4 text-center text-sm text-neutral-400">
            No more transactions
          </div>
        )}
      </div>
    </div>
  );
}

interface FeedHeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

function FeedHeader({ onRefresh, isRefreshing }: FeedHeaderProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`${bitcountFont.className} text-2xl text-neutral-600`}>
            <span className="text-vibrant-red">{"//"}</span> recent transactions
          </h2>
          <p className="text-sm text-neutral-400 mt-1 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Statement window: last 31 days
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            "p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors cursor-pointer",
            isRefreshing && "animate-spin"
          )}
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface DayGroupProps {
  displayDate: string;
  dailyTotal: DailyTotal | null;
  transactions: ClassifiedTransaction[];
  walletAddress: string;
  newSignatures: Set<string>;
}

function DayGroup({
  displayDate,
  dailyTotal,
  transactions,
  walletAddress,
  newSignatures,
}: DayGroupProps) {
  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="font-bold text-neutral-600">
          {displayDate}
        </span>
        {dailyTotal && (
          <span className={"text-sm font-mono text-neutral-400"}>
            {dailyTotal.isPositive ? "+" : ""}
            {dailyTotal.netAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {dailyTotal.symbol}
          </span>
        )}
      </div>
      <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
        {transactions.map((tx) => (
          <TransactionRow
            key={tx.tx.signature}
            transaction={tx}
            walletAddress={walletAddress}
            isNew={newSignatures.has(tx.tx.signature)}
          />
        ))}
      </div>
    </div>
  );
}

function DayGroupSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="h-4 w-16 bg-neutral-200 rounded animate-pulse" />
        <div className="h-4 w-20 bg-neutral-200 rounded animate-pulse" />
      </div>
      <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <TransactionRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function StatementCutoffFooter() {
  return (
    <div className="py-6 text-center">
      <div className="flex items-center justify-center gap-3 mb-3">
        <div className="h-px flex-1 bg-neutral-200" />
        <span className="text-sm font-medium text-neutral-500">
          End of statement
        </span>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>
      <p className="text-sm text-neutral-500 mb-1">
        You&apos;re viewing the last 31 days.
      </p>
      <p className="text-sm text-neutral-400">
        Older statements require a request (coming soon).
      </p>
    </div>
  );
}

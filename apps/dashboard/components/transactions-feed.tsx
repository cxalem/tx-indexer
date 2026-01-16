"use client";

import { useEffect, useRef, useMemo, useCallback, memo } from "react";
import type { ClassifiedTransaction } from "tx-indexer";
import { TransactionListWithHover } from "@/components/transaction-list-hover";
import { TransactionRowSkeleton } from "@/components/skeletons";
import {
  useTransactionsFeed,
  groupTransactionsByDay,
  type DailyTotal,
} from "@/hooks/use-transactions-feed";
import { useTransactionNotifications } from "@/hooks/use-transaction-notifications";
import { useWalletLabels } from "@/hooks/use-wallet-labels";
import { NotificationBanner } from "@/components/notification-banner";
import { cn } from "@/lib/utils";
import { Inbox, RefreshCw, Clock, Loader2 } from "lucide-react";
import localFont from "next/font/local";
import {
  STANDARD_POLLING_INTERVAL_MS,
  FAST_POLLING_INTERVAL_MS,
  STATEMENT_WINDOW_DAYS,
} from "@/lib/constants";

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
  const { notifyNewTransactions } = useTransactionNotifications({
    walletAddress,
  });
  const { labels } = useWalletLabels();

  const {
    transactions,
    newSignatures,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isCheckingForNew,
    hasMore,
    reachedStatementCutoff,
    loadMore,
    refresh,
    pollNewTransactions,
  } = useTransactionsFeed(walletAddress, {
    pageSize: 10,
    fastPolling,
    onNewTransactions: notifyNewTransactions,
  });

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const pollingInterval = fastPolling
      ? FAST_POLLING_INTERVAL_MS
      : STANDARD_POLLING_INTERVAL_MS;

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
      { rootMargin: "200px" },
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
    [transactions, walletAddress],
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
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 mx-auto mb-4 flex items-center justify-center">
            <Inbox
              className="h-6 w-6 text-neutral-400 dark:text-neutral-500"
              aria-hidden="true"
            />
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 mb-1">
            no transactions found
          </p>
          <p className="text-sm text-neutral-400 dark:text-neutral-500">
            your recent activity will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <FeedHeader
        onRefresh={handleRefresh}
        isRefreshing={isFetching}
        isCheckingForNew={isCheckingForNew}
      />
      <NotificationBanner />

      <div className="space-y-4">
        {transactionsByDay.map((dayGroup) => (
          <DayGroup
            key={dayGroup.dateKey}
            displayDate={dayGroup.displayDate}
            dailyTotal={dayGroup.dailyTotal}
            transactions={dayGroup.transactions}
            walletAddress={walletAddress}
            newSignatures={newSignatures}
            labels={labels}
          />
        ))}

        <div ref={loadMoreRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4 gap-2 text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="text-sm">Loading more…</span>
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
  isCheckingForNew?: boolean;
}

function FeedHeader({
  onRefresh,
  isRefreshing,
  isCheckingForNew,
}: FeedHeaderProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between">
        <div>
          <h2
            className={`${bitcountFont.className} text-2xl text-neutral-600 dark:text-neutral-400`}
          >
            <span className="text-vibrant-red">{"//"}</span> recent transactions
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Statement window: last {STATEMENT_WINDOW_DAYS} days
            </p>
            {isCheckingForNew && (
              <span className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Checking for new…
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh transactions"
          className={cn(
            "p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer",
            isRefreshing && "animate-spin",
          )}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
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
  labels: Map<string, string>;
}

const DayGroup = memo(function DayGroup({
  displayDate,
  dailyTotal,
  transactions,
  walletAddress,
  newSignatures,
  labels,
}: DayGroupProps) {
  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="font-bold text-neutral-600 dark:text-neutral-400">
          {displayDate}
        </span>
        {dailyTotal && (
          <span
            className={
              "text-sm font-mono text-neutral-400 dark:text-neutral-500"
            }
          >
            {dailyTotal.isPositive ? "+" : ""}
            {dailyTotal.netAmount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {dailyTotal.symbol}
          </span>
        )}
      </div>
      <TransactionListWithHover
        transactions={transactions}
        walletAddress={walletAddress}
        newSignatures={newSignatures}
        labels={labels}
      />
    </div>
  );
});

function DayGroupSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
      </div>
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 overflow-hidden">
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
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
        <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          End of statement
        </span>
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
      </div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">
        You&apos;re viewing the last 31 days.
      </p>
      <p className="text-sm text-neutral-400 dark:text-neutral-500">
        Older statements require a request (coming soon).
      </p>
    </div>
  );
}

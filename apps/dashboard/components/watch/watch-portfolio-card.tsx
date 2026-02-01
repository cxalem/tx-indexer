"use client";

import { PortfolioOverview } from "@/components/assets/portfolio-overview";
import { useWatchPortfolio } from "@/hooks/use-watch-data";
import { FileSpreadsheet } from "lucide-react";

interface WatchPortfolioCardProps {
  walletAddress: string;
}

/**
 * Portfolio card for watch mode layout.
 * Placed at the layout level so it persists across tab navigation.
 */
export function WatchPortfolioCard({ walletAddress }: WatchPortfolioCardProps) {
  const { balance, portfolio, isLoading } = useWatchPortfolio(walletAddress);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 p-4 sm:p-6 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded" />
            <div className="h-8 w-40 bg-neutral-200 dark:bg-neutral-700 rounded" />
            <div className="h-4 w-24 bg-neutral-100 dark:bg-neutral-800 rounded" />
          </div>
          <div className="w-full sm:w-48 h-16 bg-neutral-100 dark:bg-neutral-800 rounded" />
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-4">
            <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-700 rounded" />
            <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // No data state - show empty card
  if (!balance || !portfolio) {
    return null;
  }

  return (
    <div className="space-y-3">
      <PortfolioOverview
        portfolio={portfolio}
        tokenCount={balance.tokens.length}
      />

      {/* Export CSV - Coming Soon */}
      <button
        type="button"
        disabled
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 text-neutral-400 dark:text-neutral-500 cursor-not-allowed transition-colors"
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-medium">export .csv</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
          soon
        </span>
      </button>
    </div>
  );
}

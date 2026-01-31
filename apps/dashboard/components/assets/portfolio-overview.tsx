"use client";

import { useEffect, useState } from "react";
import type { PortfolioSummary } from "@/app/actions/dashboard";
import {
  getPortfolioValueHistory,
  type PricePoint,
} from "@/app/actions/assets";
import { PortfolioChart } from "./portfolio-chart";
import { TrendingUp, TrendingDown, Minus, Coins, Image } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioOverviewProps {
  portfolio: PortfolioSummary | null;
  tokenCount: number;
  nftCount?: number;
}

export function PortfolioOverview({
  portfolio,
  tokenCount,
  nftCount = 0,
}: PortfolioOverviewProps) {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [portfolioChange, setPortfolioChange] = useState<{
    usd: number;
    percent: number;
  } | null>(null);

  useEffect(() => {
    async function loadPriceHistory() {
      setIsLoadingHistory(true);
      try {
        const history = await getPortfolioValueHistory("7d");
        setPriceHistory(history);

        // Calculate portfolio change based on history
        if (history.length >= 2 && portfolio) {
          const oldest = history[0];
          const newest = history[history.length - 1];
          if (oldest && newest && oldest.price > 0) {
            // Estimate the portfolio value change proportionally to price change
            const priceChangePercent =
              ((newest.price - oldest.price) / oldest.price) * 100;
            const estimatedUsdChange =
              (portfolio.totalUsd * priceChangePercent) / 100;
            setPortfolioChange({
              usd: estimatedUsdChange,
              percent: priceChangePercent,
            });
          }
        }
      } catch (error) {
        console.error("Failed to load portfolio history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    if (portfolio) {
      loadPriceHistory();
    }
  }, [portfolio]);

  const totalValue = portfolio?.totalUsd ?? 0;
  const isPositiveChange = portfolioChange && portfolioChange.percent > 0;
  const isNegativeChange = portfolioChange && portfolioChange.percent < 0;
  const isNeutralChange = !portfolioChange || portfolioChange.percent === 0;

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            total portfolio value
          </p>
          <p className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
            $
            {totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>

          {/* Portfolio Change */}
          <div className="flex items-center gap-2 mt-1">
            {portfolioChange ? (
              <>
                <span
                  className={cn(
                    "flex items-center gap-1 text-sm font-medium",
                    isPositiveChange && "text-green-600 dark:text-green-400",
                    isNegativeChange && "text-red-600 dark:text-red-400",
                    isNeutralChange && "text-neutral-500 dark:text-neutral-400",
                  )}
                >
                  {isPositiveChange && (
                    <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isNegativeChange && (
                    <TrendingDown className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isNeutralChange && (
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isPositiveChange && "+"}
                  {portfolioChange.percent.toFixed(2)}%
                </span>
                <span className="text-sm text-neutral-400 dark:text-neutral-500">
                  {isPositiveChange && "+"}$
                  {Math.abs(portfolioChange.usd).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  (7d)
                </span>
              </>
            ) : (
              <span className="text-sm text-neutral-400 dark:text-neutral-500">
                —
              </span>
            )}
          </div>
        </div>

        {/* Mini Chart */}
        <div className="w-full sm:w-48 h-16">
          {isLoadingHistory ? (
            <div className="w-full h-full bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
          ) : priceHistory.length > 0 ? (
            <PortfolioChart
              data={priceHistory}
              isPositive={isPositiveChange ?? true}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-500 text-xs">
              no data
            </div>
          )}
        </div>
      </div>

      {/* Holdings Summary */}
      <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-1.5">
            <Coins className="h-4 w-4" aria-hidden="true" />
            {tokenCount} token{tokenCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <Image className="h-4 w-4" aria-hidden="true" />
            {nftCount} NFT{nftCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

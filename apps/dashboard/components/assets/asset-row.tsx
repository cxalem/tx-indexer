"use client";

import { useState, useEffect, memo, useCallback } from "react";
import { getTokenInfo } from "tx-indexer";
import type { TokenAccountBalance } from "tx-indexer/advanced";
import type {
  TokenPriceData,
  Timeframe,
  PricePoint,
} from "@/app/actions/assets";
import { getTokenPriceHistory } from "@/app/actions/assets";
import { TokenIcon } from "@/components/token-icon";
import { Sparkline } from "./sparkline";
import { PriceChart } from "./price-chart";
import { useDrawer, type DrawerToken } from "@/contexts/drawer-context";
import {
  ChevronDown,
  Send,
  ArrowLeftRight,
  QrCode,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SENDABLE_MINTS } from "@/lib/constants";

interface AssetRowProps {
  token: TokenAccountBalance;
  priceData: TokenPriceData | null;
  walletAddress: string;
  disableHover?: boolean;
}

export const AssetRow = memo(function AssetRow({
  token,
  priceData,
  walletAddress,
  disableHover = false,
}: AssetRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("24h");
  const [chartData, setChartData] = useState<PricePoint[]>(
    priceData?.priceHistory ?? [],
  );
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  const { openSendDrawer, openTradeDrawer, openReceiveDrawer } = useDrawer();

  // Get full token info (with logoURI) from registry
  const tokenInfo = getTokenInfo(token.mint);
  const logoURI = tokenInfo?.logoURI;
  const tokenName = tokenInfo?.name ?? token.symbol;

  // Create drawer token object
  const drawerToken: DrawerToken = {
    mint: token.mint,
    symbol: token.symbol,
    name: tokenName,
    logoURI,
    decimals: token.decimals,
    balance: token.amount.ui,
  };

  const usdValue = priceData?.price ? token.amount.ui * priceData.price : null;

  const priceChange = priceData?.priceChange24h ?? null;
  const isPositiveChange = priceChange !== null && priceChange >= 0;

  // Fetch chart data when timeframe changes
  useEffect(() => {
    async function fetchChartData() {
      // For 24h, use existing data
      if (selectedTimeframe === "24h" && priceData?.priceHistory) {
        setChartData(priceData.priceHistory);
        return;
      }

      setIsLoadingChart(true);
      try {
        const history = await getTokenPriceHistory(
          token.mint,
          selectedTimeframe,
        );
        setChartData(history);
      } catch (error) {
        console.error("Failed to fetch chart data:", error);
      } finally {
        setIsLoadingChart(false);
      }
    }

    if (isExpanded) {
      fetchChartData();
    }
  }, [selectedTimeframe, isExpanded, token.mint, priceData?.priceHistory]);

  return (
    <div className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
      {/* Collapsed Row Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full p-4 text-left cursor-pointer",
          !disableHover &&
            "hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-200 ease-out",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Token Icon & Name */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <TokenIcon symbol={token.symbol} logoURI={logoURI} size="lg" />
            <div className="min-w-0">
              <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                {token.symbol}
              </p>
              <p className="text-sm text-neutral-400 dark:text-neutral-500 truncate">
                {tokenName}
              </p>
            </div>
          </div>

          {/* 24h: Sparkline + Price Change */}
          <div className="hidden sm:flex items-center justify-center gap-1.5 w-24 flex-shrink-0">
            <Sparkline
              data={priceData?.priceHistory ?? []}
              isPositive={isPositiveChange}
              width={40}
              height={16}
            />
            {priceChange !== null && (
              <span
                className={cn(
                  "text-xs font-medium",
                  isPositiveChange
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {isPositiveChange && "+"}
                {priceChange.toFixed(1)}%
              </span>
            )}
          </div>

          {/* USD Value */}
          <div className="w-24 text-right flex-shrink-0">
            {usdValue !== null ? (
              <p className="font-mono text-neutral-900 dark:text-neutral-100">
                $
                {usdValue.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </p>
            ) : (
              <p className="font-mono text-neutral-400 dark:text-neutral-500">
                --
              </p>
            )}
          </div>

          {/* Chevron */}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 flex-shrink-0",
              isExpanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Expanded Details */}
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-0">
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    value
                  </p>
                  <p className="font-mono text-neutral-900 dark:text-neutral-100">
                    {usdValue !== null
                      ? `$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    balance
                  </p>
                  <p className="font-mono text-neutral-900 dark:text-neutral-100">
                    {token.amount.ui.toLocaleString(undefined, {
                      maximumFractionDigits: token.decimals,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    price
                  </p>
                  <p className="font-mono text-neutral-900 dark:text-neutral-100">
                    {priceData?.price !== null && priceData?.price !== undefined
                      ? `$${priceData.price.toLocaleString(undefined, {
                          maximumFractionDigits: priceData.price < 0.01 ? 6 : 2,
                        })}`
                      : "--"}
                  </p>
                </div>
              </div>

              {/* Chart with Timeframe Toggles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    price history
                  </p>
                  <div className="flex gap-1">
                    {(["24h", "7d", "30d"] as Timeframe[]).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setSelectedTimeframe(tf)}
                        className={cn(
                          "px-2 py-1 text-xs rounded transition-colors",
                          selectedTimeframe === tf
                            ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                            : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700",
                        )}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-32 w-full">
                  {isLoadingChart ? (
                    <div className="w-full h-full bg-neutral-100 dark:bg-neutral-700 rounded animate-pulse" />
                  ) : (
                    <PriceChart
                      data={chartData}
                      isPositive={isPositiveChange}
                      timeframe={selectedTimeframe}
                    />
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                {SENDABLE_MINTS.has(token.mint) && (
                  <ActionButton
                    icon={Send}
                    label="Send"
                    onClick={() => openSendDrawer(drawerToken)}
                  />
                )}
                <ActionButton
                  icon={ArrowLeftRight}
                  label="Trade"
                  onClick={() => openTradeDrawer(drawerToken)}
                />
                <ActionButton
                  icon={QrCode}
                  label="Receive"
                  onClick={() => openReceiveDrawer(drawerToken)}
                />
                <ActionButton icon={Activity} label="Activity" disabled />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}

function ActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors",
        disabled
          ? "bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
          : "bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-500",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
      {disabled && <span className="text-[10px] opacity-60">soon</span>}
    </button>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getBalanceAndPortfolio,
  type PortfolioSummary,
} from "@/app/actions/dashboard";
import type { EnrichedWalletBalance } from "@/app/actions/token-metadata";

// Query key factory for watch data
export const watchKeys = {
  all: ["watch"] as const,
  portfolio: (address: string) =>
    [...watchKeys.all, "portfolio", address] as const,
};

interface WatchPortfolioData {
  balance: EnrichedWalletBalance;
  portfolio: PortfolioSummary;
}

/**
 * Shared hook for watch mode portfolio/balance data.
 * Uses a single query key so the data is shared across tabs.
 */
export function useWatchPortfolio(walletAddress: string) {
  const query = useQuery<WatchPortfolioData>({
    queryKey: watchKeys.portfolio(walletAddress),
    queryFn: () => getBalanceAndPortfolio(walletAddress),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 3 * 60 * 1000, // 3 minutes (slow polling for watch mode)
    enabled: !!walletAddress,
  });

  return {
    balance: query.data?.balance ?? null,
    portfolio: query.data?.portfolio ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}

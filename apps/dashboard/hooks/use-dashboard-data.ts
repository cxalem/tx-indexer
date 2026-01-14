"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  getBalanceAndPortfolio,
  type PortfolioSummary,
} from "@/app/actions/dashboard";
import type { WalletBalance } from "tx-indexer/advanced";
import {
  USDC_MINT,
  EMPTY_DASHBOARD_QUERY_KEY,
  STANDARD_POLLING_INTERVAL_MS,
  FAST_POLLING_INTERVAL_MS,
  STANDARD_STALE_TIME_MS,
  FAST_STALE_TIME_MS,
} from "@/lib/constants";

// Query key factory for dashboard data
export const dashboardKeys = {
  all: ["dashboard"] as const,
  balanceAndPortfolio: (address: string) =>
    [...dashboardKeys.all, "balance-portfolio", address] as const,
};

interface BalanceAndPortfolioData {
  balance: WalletBalance;
  portfolio: PortfolioSummary;
}

interface UseDashboardDataOptions {
  /** Enable faster polling (e.g., after a transaction) */
  fastPolling?: boolean;
}

/**
 * Hook to fetch and cache balance + portfolio data
 *
 * NOTE: Transactions are handled separately by useTransactionsFeed
 * which has its own Redis caching layer. This separation:
 * - Eliminates duplicate transaction fetches
 * - Allows independent refresh rates
 * - Keeps balance/portfolio fast (single RPC call)
 */
export function useDashboardData(
  address: string | null,
  options: UseDashboardDataOptions = {},
) {
  const { fastPolling = false } = options;
  const queryClient = useQueryClient();

  const query = useQuery<BalanceAndPortfolioData | null>({
    queryKey: address
      ? dashboardKeys.balanceAndPortfolio(address)
      : EMPTY_DASHBOARD_QUERY_KEY,
    queryFn: async () => {
      if (!address) return null;
      return getBalanceAndPortfolio(address);
    },
    enabled: !!address,
    refetchInterval: fastPolling
      ? FAST_POLLING_INTERVAL_MS
      : STANDARD_POLLING_INTERVAL_MS,
    staleTime: fastPolling ? FAST_STALE_TIME_MS : STANDARD_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

  const refetch = useCallback(() => {
    if (address) {
      return queryClient.invalidateQueries({
        queryKey: dashboardKeys.balanceAndPortfolio(address),
      });
    }
  }, [queryClient, address]);

  const invalidateAll = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: dashboardKeys.all,
    });
  }, [queryClient]);

  const usdcBalance = useMemo(() => {
    if (!query.data?.balance) return null;
    const usdcToken = query.data.balance.tokens.find(
      (token) => token.mint === USDC_MINT,
    );
    return usdcToken?.amount.ui ?? 0;
  }, [query.data?.balance]);

  return {
    portfolio: query.data?.portfolio ?? null,
    balance: query.data?.balance ?? null,
    usdcBalance,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch,
    invalidateAll,
  };
}

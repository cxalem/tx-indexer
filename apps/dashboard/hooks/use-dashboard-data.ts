"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import {
  getDashboardData,
  getBalanceAndPortfolio,
  getNewTransactions,
  type DashboardData,
} from "@/app/actions/dashboard";
import type { ClassifiedTransaction } from "tx-indexer";

// Query key factory for dashboard data
export const dashboardKeys = {
  all: ["dashboard"] as const,
  data: (address: string) => [...dashboardKeys.all, "data", address] as const,
};

// USDC mint address
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface UseDashboardDataOptions {
  limit?: number;
  /** Enable faster polling (e.g., after a transaction) */
  fastPolling?: boolean;
}

/**
 * Hook to fetch and cache dashboard data (balance + transactions)
 * Uses React Query for automatic caching, refetching, and instant updates
 *
 * Optimized for minimal RPC calls:
 * - Initial load: full fetch (~13 RPC calls)
 * - Subsequent polls: incremental fetch (~4 RPC calls)
 */
export function useDashboardData(
  address: string | null,
  options: UseDashboardDataOptions = {},
) {
  const { limit = 10, fastPolling = false } = options;
  const queryClient = useQueryClient();

  const hasInitialData = useRef(false);
  const latestSignatureRef = useRef<string | null>(null);

  const query = useQuery<DashboardData | null>({
    queryKey: address ? dashboardKeys.data(address) : ["dashboard", "empty"],
    queryFn: async ({ queryKey }) => {
      if (!address) return null;

      const cachedData = queryClient.getQueryData<DashboardData | null>(
        queryKey,
      );

      if (
        cachedData &&
        cachedData.transactions.length > 0 &&
        hasInitialData.current
      ) {
        const latestSig = cachedData.transactions[0]?.tx.signature;

        const [balanceData, newTxs] = await Promise.all([
          getBalanceAndPortfolio(address),
          latestSig
            ? getNewTransactions(address, latestSig, limit)
            : Promise.resolve([] as ClassifiedTransaction[]),
        ]);

        const mergedTransactions = mergeTransactions(
          newTxs,
          cachedData.transactions,
          limit,
        );

        return {
          balance: balanceData.balance,
          portfolio: balanceData.portfolio,
          transactions: mergedTransactions,
        };
      }

      hasInitialData.current = true;
      return getDashboardData(address, limit);
    },
    enabled: !!address,
    // Polling intervals
    refetchInterval: fastPolling ? 10 * 1000 : 60 * 1000,
    staleTime: fastPolling ? 5 * 1000 : 30 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

  if (query.data?.transactions[0]?.tx.signature) {
    latestSignatureRef.current = query.data.transactions[0].tx.signature;
  }

  const refetch = useCallback(() => {
    if (address) {
      hasInitialData.current = false; // Force full fetch
      return queryClient.invalidateQueries({
        queryKey: dashboardKeys.data(address),
      });
    }
  }, [queryClient, address]);

  const invalidateAll = useCallback(() => {
    hasInitialData.current = false;
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
    transactions: query.data?.transactions ?? [],
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

/**
 * Merge new transactions with existing ones, maintaining sort order and limit
 */
function mergeTransactions(
  newTxs: ClassifiedTransaction[],
  existingTxs: ClassifiedTransaction[],
  limit: number,
): ClassifiedTransaction[] {
  if (newTxs.length === 0) {
    return existingTxs;
  }

  const existingSignatures = new Set(existingTxs.map((tx) => tx.tx.signature));

  const uniqueNewTxs = newTxs.filter(
    (tx) => !existingSignatures.has(tx.tx.signature),
  );

  if (uniqueNewTxs.length === 0) {
    return existingTxs;
  }

  return [...uniqueNewTxs, ...existingTxs].slice(0, limit);
}

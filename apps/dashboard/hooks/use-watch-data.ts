"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getBalanceAndPortfolio,
  getWalletFundingSource,
  type PortfolioSummary,
  type WalletFundingSourceResult,
} from "@/app/actions/dashboard";
import type { EnrichedWalletBalance } from "@/app/actions/token-metadata";
import type { NftAsset } from "@/app/actions/nfts";

export const watchKeys = {
  all: ["watch"] as const,
  portfolio: (address: string) =>
    [...watchKeys.all, "portfolio", address] as const,
  funding: (address: string) => [...watchKeys.all, "funding", address] as const,
};

interface WatchPortfolioData {
  balance: EnrichedWalletBalance;
  portfolio: PortfolioSummary;
  nfts: NftAsset[];
  nftCount: number;
}

export function useWatchPortfolio(walletAddress: string) {
  const query = useQuery<WatchPortfolioData>({
    queryKey: watchKeys.portfolio(walletAddress),
    queryFn: () => getBalanceAndPortfolio(walletAddress),
    staleTime: 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
    enabled: !!walletAddress,
  });

  return {
    balance: query.data?.balance ?? null,
    portfolio: query.data?.portfolio ?? null,
    nfts: query.data?.nfts ?? [],
    nftCount: query.data?.nftCount ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}

export function useWatchFundingSource(walletAddress: string) {
  const query = useQuery<WalletFundingSourceResult>({
    queryKey: watchKeys.funding(walletAddress),
    queryFn: () => getWalletFundingSource(walletAddress),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    enabled: !!walletAddress,
  });

  return {
    funding: query.data?.funding ?? null,
    identity: query.data?.identity ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}

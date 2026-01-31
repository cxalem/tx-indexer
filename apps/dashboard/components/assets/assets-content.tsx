"use client";

import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { bitcountFont } from "@/lib/fonts";
import { PortfolioOverview } from "./portfolio-overview";
import { TokensList } from "./tokens-list";
import { AssetsSkeleton } from "./assets-skeleton";
import { Layers } from "lucide-react";

export function AssetsContent() {
  const { status, address } = useUnifiedWallet();
  const isConnected = status === "connected";
  const { portfolio, balance, isLoading } = useDashboardData(address);

  // Not connected state
  if (!isConnected) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2
            className={`${bitcountFont.className} text-2xl text-neutral-600 dark:text-neutral-400`}
          >
            <span className="text-vibrant-red">{"//"}</span> assets
          </h2>
        </div>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 mx-auto mb-4 flex items-center justify-center">
            <Layers
              className="h-6 w-6 text-neutral-400 dark:text-neutral-500"
              aria-hidden="true"
            />
          </div>
          <p className="text-neutral-600 dark:text-neutral-400 mb-1">
            connect your wallet to view assets
          </p>
          <p className="text-sm text-neutral-400 dark:text-neutral-500">
            your portfolio and token holdings will appear here
          </p>
        </div>
      </main>
    );
  }

  // Loading state
  if (isLoading || !balance) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2
            className={`${bitcountFont.className} text-2xl text-neutral-600 dark:text-neutral-400`}
          >
            <span className="text-vibrant-red">{"//"}</span> assets
          </h2>
        </div>
        <AssetsSkeleton />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2
          className={`${bitcountFont.className} text-2xl text-neutral-600 dark:text-neutral-400`}
        >
          <span className="text-vibrant-red">{"//"}</span> assets
        </h2>
      </div>

      <div className="space-y-6">
        <PortfolioOverview
          portfolio={portfolio}
          tokenCount={balance.tokens.length}
        />

        <TokensList balance={balance} walletAddress={address!} />
      </div>
    </main>
  );
}

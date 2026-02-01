"use client";

import { bitcountFont } from "@/lib/fonts";
import { WatchTokensList } from "./watch-tokens-list";
import { AssetsSkeleton } from "@/components/assets/assets-skeleton";
import { useWatchPortfolio } from "@/hooks/use-watch-data";
import { Layers } from "lucide-react";

interface WatchAssetsProps {
  walletAddress: string;
}

/**
 * Watch mode assets view - read-only version without action buttons
 */
export function WatchAssets({ walletAddress }: WatchAssetsProps) {
  const { balance, portfolio, isLoading, error } =
    useWatchPortfolio(walletAddress);

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-8">
        <div className="mb-4">
          <h2
            className={`${bitcountFont.className} text-2xl text-neutral-600 dark:text-neutral-400`}
          >
            <span className="text-vibrant-red">{"//"}</span> assets
          </h2>
        </div>
        <AssetsSkeleton />
      </div>
    );
  }

  // Error state
  if (error || !balance || !portfolio) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-8">
        <div className="mb-4">
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
            unable to load assets
          </p>
          <p className="text-sm text-neutral-400 dark:text-neutral-500">
            {error?.message || "please try again later"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-8">
      <div className="mb-4">
        <h2
          className={`${bitcountFont.className} text-2xl text-neutral-600 dark:text-neutral-400`}
        >
          <span className="text-vibrant-red">{"//"}</span> assets
        </h2>
      </div>

      <div className="space-y-4">
        <WatchTokensList balance={balance} />
      </div>
    </div>
  );
}

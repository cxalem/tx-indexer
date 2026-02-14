"use client";

import { useMemo } from "react";
import { ShieldCheck, Building2, ExternalLink, HelpCircle } from "lucide-react";
import { bitcountFont } from "@/lib/fonts";
import { useWatchFundingSource } from "@/hooks/use-watch-data";
import { CopyButton } from "@/components/copy-button";
import { truncate } from "@/lib/utils";

interface WatchFundingSourceCardProps {
  walletAddress: string;
}

export function WatchFundingSourceCard({
  walletAddress,
}: WatchFundingSourceCardProps) {
  const { funding, identity, isLoading } = useWatchFundingSource(walletAddress);

  const dateLabel = useMemo(() => {
    if (!funding?.timestamp) return null;
    return new Date(funding.timestamp * 1000).toLocaleString();
  }, [funding?.timestamp]);

  if (isLoading) {
    return (
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 p-4 sm:p-5 animate-pulse">
        <div className="h-5 w-36 bg-neutral-200 dark:bg-neutral-700 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-4 w-52 bg-neutral-100 dark:bg-neutral-800 rounded" />
          <div className="h-4 w-64 bg-neutral-100 dark:bg-neutral-800 rounded" />
          <div className="h-4 w-40 bg-neutral-100 dark:bg-neutral-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className={`${bitcountFont.className} text-lg text-neutral-700 dark:text-neutral-300`}
          >
            <span className="text-vibrant-red">{"//"}</span> wallet origin
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-1.5">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
            first incoming SOL funder (immediate source)
          </p>
        </div>
      </div>

      {!funding ? (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 p-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            no funding source found for this wallet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Building2
                  className="h-4 w-4 text-neutral-500 dark:text-neutral-400"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {identity?.name ||
                    funding.funderName ||
                    truncate(funding.funder)}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {truncate(funding.funder)}
                </span>
                <CopyButton value={funding.funder} />
              </div>
            </div>

            {(identity?.category || funding.funderType) && (
              <span className="inline-flex text-xs px-2 py-1 rounded-full bg-vibrant-red/10 text-vibrant-red">
                {identity?.category || funding.funderType}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                initial funding
              </p>
              <p className="font-mono text-neutral-900 dark:text-neutral-100">
                {funding.amount} {funding.symbol}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                funded at
              </p>
              <p className="text-neutral-900 dark:text-neutral-100">
                {dateLabel}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                slot
              </p>
              <p className="font-mono text-neutral-900 dark:text-neutral-100">
                {funding.slot.toLocaleString()}
              </p>
            </div>
          </div>

          <div>
            <a
              href={funding.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-vibrant-red hover:underline"
            >
              view funding transaction
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            attribution is best-effort and may be unknown for many wallets
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";

function CTASkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="h-10 w-36 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
        <span className="text-neutral-400 dark:text-neutral-500 text-sm">
          or
        </span>
        <div className="h-10 w-40 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
      </div>
      <div className="h-4 w-64 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
    </div>
  );
}

export function HeroCTA() {
  const { status, isLoading } = useUnifiedWallet();
  const isConnected = status === "connected";

  if (isLoading) {
    return <CTASkeleton />;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {isConnected ? (
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-8 py-2 bg-vibrant-red hover:bg-vibrant-red/90 text-white rounded-lg font-medium transition-colors lowercase"
        >
          go to dashboard
          <ArrowRight className="w-5 h-5" />
        </Link>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <ConnectWalletButton />
          <span className="text-neutral-400 dark:text-neutral-500 text-sm">
            or
          </span>
          <Link
            href="/watch"
            className="inline-flex items-center justify-center gap-2 px-6 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium transition-colors lowercase"
          >
            <Eye className="w-4 h-4" />
            track any wallet
          </Link>
        </div>
      )}
      <p className="text-xs text-neutral-400 dark:text-neutral-500 lowercase">
        {isConnected
          ? "view your classified transactions"
          : "connect to access full features, or watch any wallet read-only"}
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";

function CTASkeleton() {
  return (
    <>
      <div className="h-5 w-72 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse mb-8 mx-auto" />
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <div className="h-10 w-36 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
        <span className="text-neutral-400 dark:text-neutral-500 text-sm">
          or
        </span>
        <div className="h-10 w-40 bg-neutral-200 dark:bg-neutral-800 rounded-lg animate-pulse" />
      </div>
    </>
  );
}

export function FooterCTA() {
  const { status, isLoading } = useUnifiedWallet();
  const isConnected = status === "connected";

  if (isLoading) {
    return <CTASkeleton />;
  }

  return (
    <>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8 lowercase">
        {isConnected
          ? "your wallet is connected. view your transactions."
          : "connect your wallet or track any wallet read-only."}
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {isConnected ? (
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-2 bg-vibrant-red hover:bg-vibrant-red/90 text-white rounded-lg font-medium transition-colors lowercase"
          >
            go to dashboard
            <ArrowRight className="w-5 h-5" />
          </Link>
        ) : (
          <>
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
          </>
        )}
      </div>
    </>
  );
}

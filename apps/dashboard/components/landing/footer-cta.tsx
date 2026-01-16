"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";

export function FooterCTA() {
  const { status } = useUnifiedWallet();
  const isConnected = status === "connected";

  return (
    <>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8 lowercase">
        {isConnected
          ? "your wallet is connected. view your transactions."
          : "connect your wallet to get started."}
      </p>

      <div className="flex justify-center">
        {isConnected ? (
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-2 bg-vibrant-red hover:bg-vibrant-red/90 text-white rounded-lg font-medium transition-colors lowercase"
          >
            go to dashboard
            <ArrowRight className="w-5 h-5" />
          </Link>
        ) : (
          <ConnectWalletButton />
        )}
      </div>
    </>
  );
}

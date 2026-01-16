"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { PortfolioCard } from "@/components/portfolio-card";
import { TransactionsFeed } from "@/components/transactions-feed";
import {
  PortfolioCardSkeleton,
  TransactionsListSkeleton,
} from "@/components/skeletons";
import { ErrorBoundary } from "@/components/error-boundary";
import { Inbox, Wallet, Clock } from "lucide-react";
import localFont from "next/font/local";
import {
  FAST_POLLING_DURATION_MS,
  STATEMENT_WINDOW_DAYS,
} from "@/lib/constants";

// Lazy load heavy drawer components - only loaded when user opens them
const SendTransferDrawer = dynamic(
  () =>
    import("@/components/send-transfer").then((mod) => mod.SendTransferDrawer),
  { ssr: false },
);

const TradeDrawer = dynamic(
  () => import("@/components/trade").then((mod) => mod.TradeDrawer),
  { ssr: false },
);

const bitcountFont = localFont({
  src: "../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export function DashboardContent() {
  const { status, address } = useUnifiedWallet();
  const isConnected = status === "connected";
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false);
  const [fastPolling, setFastPolling] = useState(false);

  // Track if drawers have been opened at least once (for lazy loading with exit animations)
  const sendDrawerMounted = useRef(false);
  const tradeDrawerMounted = useRef(false);

  if (sendDrawerOpen) sendDrawerMounted.current = true;
  if (tradeDrawerOpen) tradeDrawerMounted.current = true;

  const { portfolio, balance, usdcBalance, isLoading, refetch } =
    useDashboardData(address, { fastPolling });

  const tokenBalances =
    balance?.tokens.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      uiAmount: t.amount.ui,
    })) ?? [];

  const handleTransactionSuccess = () => {
    setFastPolling(true);
    refetch();
    setTimeout(() => setFastPolling(false), FAST_POLLING_DURATION_MS);
  };

  if (!isConnected) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <Wallet
                  className="h-5 w-5 text-neutral-400 dark:text-neutral-500"
                  aria-hidden="true"
                />
              </div>
              <span className="text-neutral-500 dark:text-neutral-400">
                portfolio
              </span>
            </div>
            <p className="text-2xl font-mono text-neutral-300 dark:text-neutral-600">
              —
            </p>
          </div>
        </div>

        <div>
          <div className="mb-4">
            <h2
              className={`${bitcountFont.className} text-2xl text-neutral-600 dark:text-neutral-400`}
            >
              <span className="text-vibrant-red">{"//"}</span> recent
              transactions
            </h2>
            <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Statement window: last {STATEMENT_WINDOW_DAYS} days
            </p>
          </div>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 mx-auto mb-4 flex items-center justify-center">
              <Inbox
                className="h-6 w-6 text-neutral-400 dark:text-neutral-500"
                aria-hidden="true"
              />
            </div>
            <p className="text-neutral-600 dark:text-neutral-400 mb-1">
              connect your wallet
            </p>
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              to view your recent transactions
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <PortfolioCardSkeleton />
        </div>

        <div>
          <div className="mb-4">
            <h2
              className={`${bitcountFont.className} text-2xl text-neutral-600 dark:text-neutral-400`}
            >
              <span className="text-vibrant-red">{"//"}</span> recent
              transactions
            </h2>
            <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Statement window: last {STATEMENT_WINDOW_DAYS} days
            </p>
          </div>
          <TransactionsListSkeleton count={5} />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <ErrorBoundary section="portfolio">
          <PortfolioCard
            portfolio={portfolio}
            walletAddress={address}
            onSend={() => setSendDrawerOpen(true)}
            onTrade={() => setTradeDrawerOpen(true)}
          />
        </ErrorBoundary>
      </div>

      <ErrorBoundary section="transactions">
        <TransactionsFeed walletAddress={address!} fastPolling={fastPolling} />
      </ErrorBoundary>

      {/* Lazy loaded drawers - mounted after first open, kept mounted for exit animations */}
      {sendDrawerMounted.current && (
        <SendTransferDrawer
          open={sendDrawerOpen}
          onOpenChange={setSendDrawerOpen}
          onTransferSuccess={handleTransactionSuccess}
          usdcBalance={usdcBalance}
        />
      )}

      {tradeDrawerMounted.current && (
        <TradeDrawer
          open={tradeDrawerOpen}
          onOpenChange={setTradeDrawerOpen}
          onTradeSuccess={handleTransactionSuccess}
          solBalance={balance?.sol.ui}
          tokenBalances={tokenBalances}
        />
      )}
    </main>
  );
}

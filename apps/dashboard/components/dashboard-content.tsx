"use client";

import { useWallet } from "@solana/react-hooks";
import { useState } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { cn } from "@/lib/utils";
import { PortfolioCard } from "@/components/portfolio-card";
import { TransactionsList } from "@/components/transactions-list";
import { SendTransferDrawer } from "@/components/send-transfer";
import { TradeDrawer } from "@/components/trade";
import {
  PortfolioCardSkeleton,
  TransactionsListSkeleton,
} from "@/components/skeletons";
import { Inbox, Wallet, RefreshCw } from "lucide-react";
import localFont from "next/font/local";

const bitcountFont = localFont({
  src: "../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export function DashboardContent() {
  const wallet = useWallet();
  const isConnected = wallet.status === "connected";
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false);
  const [fastPolling, setFastPolling] = useState(false);

  const address = isConnected
    ? wallet.session.account.address.toString()
    : null;

  const {
    portfolio,
    transactions,
    balance,
    usdcBalance,
    isLoading,
    isFetching,
    refetch,
  } = useDashboardData(address, { fastPolling });

  const tokenBalances =
    balance?.tokens.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      uiAmount: t.amount.ui,
    })) ?? [];

  const handleTransactionSuccess = () => {
    setFastPolling(true);
    refetch();
    setTimeout(() => setFastPolling(false), 30 * 1000);
  };

  if (!isConnected) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="border border-neutral-200 rounded-lg bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-neutral-100">
                <Wallet className="h-5 w-5 text-neutral-400" />
              </div>
              <span className="text-neutral-500">portfolio</span>
            </div>
            <p className="text-2xl font-mono text-neutral-300">—</p>
          </div>
        </div>

        <div>
          <h2
            className={`${bitcountFont.className} text-2xl text-neutral-600 mb-4`}
          >
            <span className="text-vibrant-red">{"//"}</span> recent transactions
          </h2>
          <div className="border border-neutral-200 rounded-lg bg-white p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-100 mx-auto mb-4 flex items-center justify-center">
              <Inbox className="h-6 w-6 text-neutral-400" />
            </div>
            <p className="text-neutral-600 mb-1">connect your wallet</p>
            <p className="text-sm text-neutral-400">
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
          <h2
            className={`${bitcountFont.className} text-2xl text-neutral-600 mb-4`}
          >
            <span className="text-vibrant-red">{"//"}</span> recent transactions
          </h2>
          <TransactionsListSkeleton count={5} />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <PortfolioCard
          portfolio={portfolio}
          walletAddress={address}
          onSend={() => setSendDrawerOpen(true)}
          onTrade={() => setTradeDrawerOpen(true)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`${bitcountFont.className} text-2xl text-neutral-600`}>
            <span className="text-vibrant-red">{"//"}</span> recent transactions
          </h2>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className={cn(
              "p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 transition-colors",
              isFetching && "animate-spin",
            )}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <TransactionsList
          transactions={transactions}
          walletAddress={address!}
        />
      </div>

      <SendTransferDrawer
        open={sendDrawerOpen}
        onOpenChange={setSendDrawerOpen}
        onTransferSuccess={handleTransactionSuccess}
        usdcBalance={usdcBalance}
      />

      <TradeDrawer
        open={tradeDrawerOpen}
        onOpenChange={setTradeDrawerOpen}
        onTradeSuccess={handleTransactionSuccess}
        solBalance={balance?.sol.ui}
        tokenBalances={tokenBalances}
      />
    </main>
  );
}

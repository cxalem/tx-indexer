"use client";

import { useWallet } from "@solana/react-hooks";
import type { ClassifiedTransaction } from "tx-indexer";
import { useState, useEffect, useRef } from "react";
import { type PortfolioSummary } from "@/app/actions/dashboard";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import {
  formatRelativeTime,
  formatDateOnly,
  formatTime,
  truncate,
  cn,
} from "@/lib/utils";
import {
  getTransactionDirection,
  formatAmountWithDirection,
  formatSwapDetails,
} from "@/lib/transaction-utils";
import { CopyButton } from "@/components/copy-button";
import { PortfolioActions } from "@/components/portfolio-actions";
import { SendTransferDrawer } from "@/components/send-transfer-drawer";
import { TradeDrawer } from "@/components/trade-drawer";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  Sparkles,
  Circle,
  Inbox,
  Wallet,
  ChevronDown,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import localFont from "next/font/local";
import Image from "next/image";

const bitcountFont = localFont({
  src: "../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

function getIcon(type: string, direction: string) {
  const className = "h-4 w-4";

  if (direction === "incoming") {
    return <ArrowDownLeft className={className} />;
  }
  if (direction === "outgoing") {
    return <ArrowUpRight className={className} />;
  }

  switch (type) {
    case "swap":
      return <ArrowLeftRight className={className} />;
    case "transfer":
      return <ArrowRight className={className} />;
    case "airdrop":
      return <Gift className={className} />;
    case "nft_mint":
      return <Sparkles className={className} />;
    default:
      return <Circle className={className} />;
  }
}

function getIconBgClass(direction: string) {
  switch (direction) {
    case "incoming":
      return "bg-green-50 text-green-600";
    case "outgoing":
      return "bg-red-50 text-red-600";
    default:
      return "bg-neutral-100 text-neutral-600";
  }
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function PortfolioCard({
  portfolio,
  walletAddress,
  onSend,
  onTrade,
}: {
  portfolio: PortfolioSummary | null;
  walletAddress: string | null;
  onSend?: () => void;
  onTrade?: () => void;
}) {
  const total = portfolio?.totalUsd ?? 0;
  const stablecoins = portfolio?.stablecoinsUsd ?? 0;
  const variable = portfolio?.variableAssetsUsd ?? 0;
  const unpriced = portfolio?.unpricedCount ?? 0;

  return (
    <div className="border border-neutral-200 rounded-lg bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neutral-100">
            <Wallet className="h-5 w-5 text-neutral-600" />
          </div>
          <span className="text-neutral-500">portfolio</span>
          {walletAddress && (
            <div className="flex items-center gap-1">
              <span className="text-sm text-neutral-400 font-mono">
                {truncate(walletAddress)}
              </span>
              <CopyButton value={walletAddress} />
            </div>
          )}
        </div>
        <PortfolioActions
          walletAddress={walletAddress}
          onSend={onSend}
          onTrade={onTrade}
        />
      </div>
      <p className="text-3xl font-mono text-neutral-900 mb-2">
        {formatUsd(total)}
      </p>
      <p className="text-sm text-neutral-500">
        stablecoins {formatUsd(stablecoins)} · variable assets{" "}
        {formatUsd(variable)}
        {unpriced > 0 && (
          <span className="text-neutral-400"> · +{unpriced} unpriced</span>
        )}
      </p>
    </div>
  );
}

function TransactionRow({
  transaction,
  walletAddress,
  isNew = false,
}: {
  transaction: ClassifiedTransaction;
  walletAddress: string;
  isNew?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNewAnimation, setShowNewAnimation] = useState(isNew);
  const direction = getTransactionDirection(transaction, walletAddress);
  const { tx, classification } = transaction;

  // Sync animation state when isNew prop changes
  useEffect(() => {
    if (isNew) {
      setShowNewAnimation(true);
      // Clear the "new" highlight after animation completes
      const timer = setTimeout(() => setShowNewAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const isSuccess = tx.err === null;
  const isSwap = classification.primaryType === "swap";
  const isNft = ["nft_purchase", "nft_sale", "nft_mint"].includes(
    classification.primaryType
  );
  const nftMetadata = classification.metadata as
    | { nft_name?: string; nft_image?: string }
    | undefined;
  const fee = tx.fee ? tx.fee / 1e9 : 0;

  // Get animation class based on transaction direction
  const getNewAnimationClass = () => {
    if (!showNewAnimation) return "";
    if (direction.direction === "incoming")
      return "animate-new-transaction-incoming";
    if (direction.direction === "outgoing")
      return "animate-new-transaction-outgoing";
    return "animate-new-transaction-neutral";
  };

  return (
    <div
      className={cn(
        "border-b border-neutral-100 last:border-b-0 transition-all duration-500",
        getNewAnimationClass()
      )}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 hover:bg-neutral-50 transition-colors text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg",
                getIconBgClass(direction.direction)
              )}
            >
              {getIcon(classification.primaryType, direction.direction)}
            </div>
            <div>
              <p className="font-medium text-neutral-700 capitalize">
                {direction.label}
              </p>
              <div className="flex items-center gap-1">
                <span className="text-sm text-neutral-400 font-mono">
                  {truncate(tx.signature)}
                </span>
                <CopyButton value={tx.signature} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={cn("font-mono", direction.colorClass)}>
                {formatAmountWithDirection(
                  classification.primaryAmount,
                  direction
                )}
              </p>
              <p className="text-sm text-neutral-400">
                {formatRelativeTime(tx.blockTime)}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-neutral-400 transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </div>
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-0">
            <div className="bg-neutral-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-1 rounded",
                    isSuccess
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  {isSuccess ? "success" : "failed"}
                </span>
              </div>

              {isSwap && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">trade details</p>
                  <p className="font-mono text-neutral-600 bg-white border rounded-lg w-fit px-3 py-1 text-xl">
                    {formatSwapDetails(
                      classification.primaryAmount,
                      classification.secondaryAmount
                    )}
                  </p>
                </div>
              )}

              {isNft && nftMetadata?.nft_name && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">nft</p>
                  <div className="flex items-center gap-3">
                    {nftMetadata.nft_image && (
                      <Image
                        src={nftMetadata.nft_image}
                        alt={nftMetadata.nft_name}
                        width={48}
                        height={48}
                        className="rounded-lg object-cover"
                        unoptimized
                      />
                    )}
                    <p className="text-sm font-medium">
                      {nftMetadata.nft_name}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {classification.sender && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">from</p>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">
                        {truncate(classification.sender)}
                      </span>
                      <CopyButton value={classification.sender} />
                    </div>
                  </div>
                )}

                {classification.receiver && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1">to</p>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">
                        {truncate(classification.receiver)}
                      </span>
                      <CopyButton value={classification.receiver} />
                    </div>
                  </div>
                )}
              </div>

              {tx.memo && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">memo</p>
                  <p className="text-sm bg-white rounded p-2 border border-neutral-200">
                    {tx.memo}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-neutral-200">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">date</p>
                  <p className="text-sm">{formatDateOnly(tx.blockTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">time</p>
                  <p className="text-sm">{formatTime(tx.blockTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">fee</p>
                  <p className="text-sm font-mono">{fee.toFixed(6)} SOL</p>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={`https://itx-indexer.com/indexer/${tx.signature}?add=${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-vibrant-red hover:underline"
                >
                  view full details
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionsList({
  transactions,
  walletAddress,
}: {
  transactions: ClassifiedTransaction[];
  walletAddress: string;
}) {
  // Track previously seen transaction signatures to detect new ones
  const seenSignaturesRef = useRef<Set<string>>(new Set());
  const [newSignatures, setNewSignatures] = useState<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  // Create a stable key from transaction signatures to detect changes
  const transactionKey = transactions.map((tx) => tx.tx.signature).join(",");

  useEffect(() => {
    const currentSignatures = transactions.map((tx) => tx.tx.signature);

    if (!isInitializedRef.current) {
      // On first render, mark all current transactions as "seen"
      seenSignaturesRef.current = new Set(currentSignatures);
      isInitializedRef.current = true;
      return;
    }

    // Find new transactions (signatures we haven't seen before)
    const newSigs = new Set<string>();
    for (const sig of currentSignatures) {
      if (!seenSignaturesRef.current.has(sig)) {
        newSigs.add(sig);
        seenSignaturesRef.current.add(sig);
      }
    }

    if (newSigs.size > 0) {
      console.log("New transactions detected:", Array.from(newSigs));
      setNewSignatures(newSigs);
      // Clear the "new" state after animation duration
      const timer = setTimeout(() => setNewSignatures(new Set()), 3000);
      return () => clearTimeout(timer);
    }
  }, [transactionKey, transactions]);

  if (transactions.length === 0) {
    return (
      <div className="border border-neutral-200 rounded-lg bg-white p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-neutral-100 mx-auto mb-4 flex items-center justify-center">
          <Inbox className="h-6 w-6 text-neutral-400" />
        </div>
        <p className="text-neutral-600 mb-1">no transactions found</p>
        <p className="text-sm text-neutral-400">
          your recent activity will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      {transactions.map((tx) => (
        <TransactionRow
          key={tx.tx.signature}
          transaction={tx}
          walletAddress={walletAddress}
          isNew={newSignatures.has(tx.tx.signature)}
        />
      ))}
    </div>
  );
}

export function DashboardContent() {
  const wallet = useWallet();
  const isConnected = wallet.status === "connected";
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false);
  // Enable fast polling temporarily after a transaction
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

  // Prepare token balances for trade drawer
  const tokenBalances =
    balance?.tokens.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      uiAmount: t.amount.ui,
    })) ?? [];

  // Handle transfer/trade success - enable fast polling for 30 seconds
  const handleTransactionSuccess = () => {
    setFastPolling(true);
    refetch();
    // Disable fast polling after 30 seconds
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
          <div className="border border-neutral-200 rounded-lg bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-neutral-100">
                <Wallet className="h-5 w-5 text-neutral-600" />
              </div>
              <span className="text-neutral-500">portfolio</span>
            </div>
            <p className="text-2xl font-mono text-neutral-400">loading...</p>
          </div>
        </div>

        <div>
          <h2
            className={`${bitcountFont.className} text-2xl text-neutral-600 mb-4`}
          >
            <span className="text-vibrant-red">{"//"}</span> recent transactions
          </h2>
          <div className="border border-neutral-200 rounded-lg bg-white p-8 text-center">
            <p className="text-neutral-500">loading transactions...</p>
          </div>
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
              isFetching && "animate-spin"
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

"use client";

import { useWallet } from "@solana/react-hooks";
import type { ClassifiedTransaction, WalletBalance } from "tx-indexer";
import { useState, useEffect, useTransition } from "react";
import { getDashboardData } from "@/app/actions/dashboard";
import { formatNumber, formatRelativeTime, truncate } from "@/lib/utils";
import {
  ArrowLeftRight,
  ArrowRight,
  Gift,
  Sparkles,
  Circle,
  Inbox,
  Wallet,
} from "lucide-react";
import localFont from "next/font/local";

const bitcountFont = localFont({
  src: "../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

function getIcon(type: string) {
  const className = "h-4 w-4";
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

function formatAmount(
  amount:
    | {
        token: {
          symbol: string;
          mint: string;
          name?: string;
          decimals: number;
        };
        amountUi: number;
        amountRaw: string;
      }
    | null
    | undefined,
) {
  if (!amount) return "—";
  return `${amount.amountUi.toLocaleString()} ${amount.token.symbol}`;
}

function BalanceCard({
  balance,
}: {
  balance: WalletBalance | null;
  isPending: boolean;
}) {
  const solBalance = balance?.sol.ui ?? 0;

  return (
    <div className="border border-neutral-200 rounded-lg bg-white p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-neutral-100">
          <Wallet className="h-5 w-5 text-neutral-600" />
        </div>
        <span className="text-neutral-500">wallet balance</span>
      </div>
      <p className="text-3xl font-mono text-neutral-900">
        {formatNumber(solBalance, 4)}{" "}
        <span className="text-neutral-500 text-xl">SOL</span>
      </p>
    </div>
  );
}

function TransactionsList({
  transactions,
}: {
  transactions: ClassifiedTransaction[];
}) {
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
      <div className="divide-y divide-neutral-100">
        {transactions.map((tx) => (
          <div
            key={tx.tx.signature}
            className="p-4 hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-neutral-100 text-neutral-600">
                  {getIcon(tx.classification.primaryType)}
                </div>
                <div>
                  <p className="font-medium text-neutral-700 capitalize">
                    {tx.classification.primaryType.replace("_", " ")}
                  </p>
                  <p className="text-sm text-neutral-400 font-mono">
                    {truncate(tx.tx.signature)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-neutral-700">
                  {formatAmount(tx.classification.primaryAmount)}
                </p>
                <p className="text-sm text-neutral-400">
                  {formatRelativeTime(tx.tx.blockTime)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardContent() {
  const wallet = useWallet();
  const isConnected = wallet.status === "connected";
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<ClassifiedTransaction[]>([]);
  const [isPending, startTransition] = useTransition();

  const address = isConnected
    ? wallet.session.account.address.toString()
    : null;

  useEffect(() => {
    if (!address) {
      setBalance(null);
      setTransactions([]);
      return;
    }

    startTransition(async () => {
      const data = await getDashboardData(address, 10);
      setBalance(data.balance);
      setTransactions(data.transactions);
    });
  }, [address]);

  if (!isConnected) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="border border-neutral-200 rounded-lg bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-neutral-100">
                <Wallet className="h-5 w-5 text-neutral-400" />
              </div>
              <span className="text-neutral-500">wallet balance</span>
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

  if (isPending) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="border border-neutral-200 rounded-lg bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-neutral-100">
                <Wallet className="h-5 w-5 text-neutral-600" />
              </div>
              <span className="text-neutral-500">wallet balance</span>
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
        <BalanceCard balance={balance} isPending={isPending} />
      </div>

      <div>
        <h2
          className={`${bitcountFont.className} text-2xl text-neutral-600 mb-4`}
        >
          <span className="text-vibrant-red">{"//"}</span> recent transactions
        </h2>
        <TransactionsList transactions={transactions} />
      </div>
    </main>
  );
}

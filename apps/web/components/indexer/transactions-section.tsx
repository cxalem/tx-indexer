"use client";

import { TransactionTable } from "@/components/indexer/transaction-table";
import { useWallet } from "@solana/react-hooks";
import type { ClassifiedTransaction } from "tx-indexer";
import { useState, useEffect } from "react";
import { getWalletTransactions } from "@/app/actions/transactions";
import { Skeleton } from "@/components/ui/skeleton";
import localFont from "next/font/local";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export function TransactionsSection() {
  const wallet = useWallet();
  const isConnected = wallet.status === "connected";
  const [transactions, setTransactions] = useState<ClassifiedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const address = isConnected
    ? wallet.session.account.address.toString()
    : null;

  useEffect(() => {
    if (!address) return;

    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedTransactions = await getWalletTransactions(address, 5);
        setTransactions(fetchedTransactions);
      } catch (err) {
        console.error("Failed to fetch transactions:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch transactions",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [address]);

  if (error) {
    return (
      <section className="px-4 max-w-4xl mx-auto">
        <div className="border border-red-200 rounded-lg bg-red-50 p-4 text-red-700">
          Error: {error}
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="px-4 max-w-4xl mx-auto">
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2
              className={`${bitcountFont.className} text-3xl lowercase text-neutral-600`}
            >
              <span className="text-vibrant-red">{"//"}</span> transactions
            </h2>
          </div>
          <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
            <div className="bg-neutral-50 border-b border-neutral-200 px-6 py-3">
              <div className="flex gap-20">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
            <div className="divide-y divide-neutral-100">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 max-w-4xl mx-auto">
      <TransactionTable
        transactions={transactions}
        walletAddress={address}
        title={`transactions`}
      />
    </section>
  );
}

"use client";

import { TransactionTable } from "@/components/indexer/transaction-table";
import { useWallet } from "@solana/react-hooks";
import type { ClassifiedTransaction } from "tx-indexer";
import { useState, useEffect } from "react";
import { getWalletTransactions } from "@/app/actions/transactions";

export function TransactionsSection() {
  const wallet = useWallet();
  const isConnected = wallet.status === "connected";
  const [transactions, setTransactions] = useState<ClassifiedTransaction[]>([]);

  const address = isConnected ? wallet.session.account.address : null;

  useEffect(() => {
    if (!address) return;

    const fetchTransactions = async () => {
      const fetchedTransactions = await getWalletTransactions(address, 5);
      setTransactions(fetchedTransactions);
    };

    fetchTransactions();
  }, [address]);

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

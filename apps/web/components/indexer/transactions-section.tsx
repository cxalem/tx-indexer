"use client";

import { TransactionTable } from "@/components/indexer/transaction-table";
import { useWallet } from "@solana/react-hooks";
import type { Transaction } from "@/lib/types";
import { createIndexer } from "tx-indexer";
import { useState, useEffect, useMemo } from "react";

export function TransactionsSection() {
  const wallet = useWallet();
  const isConnected = wallet.status === "connected";
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const address = isConnected ? wallet.session.account.address : null;

  console.log(process.env.RPC_URL);

  const indexer = useMemo(
    () => createIndexer({ rpcUrl: process.env.RPC_URL! }),
    []
  );
  useEffect(() => {
    if (!address) return;

    const fetchTransactions = async () => {
      const fetchedTransactions = await indexer.getTransactions(address, {
        limit: 5,
      });
      setTransactions(fetchedTransactions);
    };

    fetchTransactions();
  }, [address, indexer]);

  return (
    <section className="px-4 max-w-4xl mx-auto">
      <TransactionTable
        transactions={transactions}
        title={`transactions`}
      />
    </section>
  );
}

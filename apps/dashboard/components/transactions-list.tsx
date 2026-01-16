"use client";

import type { ClassifiedTransaction } from "tx-indexer";
import { useState, useEffect, useRef, useMemo } from "react";
import { TransactionRow } from "@/components/transaction-row";
import { Inbox } from "lucide-react";

interface TransactionsListProps {
  transactions: ClassifiedTransaction[];
  walletAddress: string;
}

export function TransactionsList({
  transactions,
  walletAddress,
}: TransactionsListProps) {
  const seenSignaturesRef = useRef<Set<string>>(new Set());
  const [newSignatures, setNewSignatures] = useState<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  const transactionKey = useMemo(
    () => transactions.map((tx) => tx.tx.signature).join(","),
    [transactions],
  );

  useEffect(() => {
    const currentSignatures = transactions.map((tx) => tx.tx.signature);

    if (!isInitializedRef.current) {
      seenSignaturesRef.current = new Set(currentSignatures);
      isInitializedRef.current = true;
      return;
    }

    const newSigs = new Set<string>();
    for (const sig of currentSignatures) {
      if (!seenSignaturesRef.current.has(sig)) {
        newSigs.add(sig);
        seenSignaturesRef.current.add(sig);
      }
    }

    if (newSigs.size > 0) {
      setNewSignatures(newSigs);
      const timer = setTimeout(() => setNewSignatures(new Set()), 3000);
      return () => clearTimeout(timer);
    }
  }, [transactionKey, transactions]);

  if (transactions.length === 0) {
    return (
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 mx-auto mb-4 flex items-center justify-center">
          <Inbox className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />
        </div>
        <p className="text-neutral-600 dark:text-neutral-400 mb-1">
          no transactions found
        </p>
        <p className="text-sm text-neutral-400 dark:text-neutral-500">
          your recent activity will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 overflow-hidden">
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

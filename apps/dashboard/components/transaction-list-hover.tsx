"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { ClassifiedTransaction } from "tx-indexer";
import { TransactionRow } from "@/components/transaction-row";

interface TransactionListWithHoverProps {
  transactions: ClassifiedTransaction[];
  walletAddress: string;
  newSignatures: Set<string>;
  labels: Map<string, string>;
}

export function TransactionListWithHover({
  transactions,
  walletAddress,
  newSignatures,
  labels,
}: TransactionListWithHoverProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 overflow-hidden"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {transactions.map((tx, index) => (
        <div
          key={tx.tx.signature}
          className="relative"
          onMouseEnter={() => setHoveredIndex(index)}
        >
          {/* Shared hover background - only rendered on the hovered item */}
          {hoveredIndex === index && (
            <motion.div
              layoutId="transaction-hover"
              className="absolute inset-0 bg-neutral-50 dark:bg-neutral-800 z-0"
              initial={false}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 35,
              }}
            />
          )}

          {/* Transaction content - always on top */}
          <div className="relative z-10">
            <TransactionRow
              transaction={tx}
              walletAddress={walletAddress}
              isNew={newSignatures.has(tx.tx.signature)}
              labels={labels}
              disableHover
            />
          </div>
        </div>
      ))}
    </div>
  );
}

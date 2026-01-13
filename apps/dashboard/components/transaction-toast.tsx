"use client";

import type { ClassifiedTransaction } from "tx-indexer";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTransactionIcon,
  getTransactionIconBgClass,
} from "@/lib/transaction-icons";
import type { TransactionDirection } from "@/lib/transaction-utils";

interface TransactionToastProps {
  transaction: ClassifiedTransaction;
  direction: TransactionDirection;
  title: string;
  body: string;
  walletAddress: string;
}

export function TransactionToast({
  transaction,
  direction,
  title,
  body,
  walletAddress,
}: TransactionToastProps) {
  const { tx, classification } = transaction;
  const detailUrl = `https://itx-indexer.com/indexer/${tx.signature}?add=${walletAddress}`;

  return (
    <div className="flex items-center gap-3 w-full">
      <div
        className={cn(
          "p-2 rounded-lg shrink-0",
          getTransactionIconBgClass(direction),
        )}
      >
        {getTransactionIcon(classification.primaryType, direction)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-neutral-900 text-sm">{title}</p>
        <p className="text-neutral-500 text-sm mt-0.5">{body}</p>
      </div>
      <a
        href={detailUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        view details
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

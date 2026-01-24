"use client";

import { Info } from "lucide-react";

interface BalanceDisplayProps {
  walletBalance: number;
  privateBalance: number;
  selectedToken: string;
  isLoadingBalance: boolean;
}

export function BalanceDisplay({
  walletBalance,
  privateBalance,
  selectedToken,
  isLoadingBalance,
}: BalanceDisplayProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
          balance
        </p>
        <p className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
          {walletBalance.toFixed(4)}{" "}
          <span className="text-sm text-neutral-500">{selectedToken}</span>
        </p>
      </div>

      <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
        <p className="text-xs text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
          private balance
          <span
            className="cursor-help"
            title="Your private balance is shielded using zero-knowledge proofs. Withdrawals cannot be linked to deposits."
          >
            <Info className="h-3 w-3" />
          </span>
        </p>
        {isLoadingBalance ? (
          <div className="h-7 w-20 bg-purple-200 dark:bg-purple-800 rounded animate-pulse" />
        ) : (
          <p className="text-lg font-medium text-purple-700 dark:text-purple-300">
            {privateBalance.toFixed(4)}{" "}
            <span className="text-sm text-purple-500">{selectedToken}</span>
          </p>
        )}
      </div>
    </div>
  );
}

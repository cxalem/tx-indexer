"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperationMode } from "./types";

interface AmountInputProps {
  amount: string;
  selectedToken: string;
  insufficientBalance: boolean;
  mode: OperationMode;
  onAmountChange: (value: string) => void;
  onSetMax: () => void;
}

export function AmountInput({
  amount,
  selectedToken,
  insufficientBalance,
  mode,
  onAmountChange,
  onSetMax,
}: AmountInputProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          amount
        </label>
        <button
          type="button"
          onClick={onSetMax}
          className="text-xs text-purple-500 hover:text-purple-400"
        >
          max
        </button>
      </div>
      <div className="relative">
        <input
          type="number"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          step="0.0001"
          min="0"
          className={cn(
            "w-full px-3 py-2.5 pr-16 rounded-lg border bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 transition-colors",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:border-purple-500",
            insufficientBalance
              ? "border-red-300 dark:border-red-700"
              : "border-neutral-200 dark:border-neutral-700",
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
          {selectedToken}
        </span>
      </div>
      {insufficientBalance && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          Insufficient {mode === "deposit" ? "balance" : "private balance"}
        </p>
      )}
    </div>
  );
}

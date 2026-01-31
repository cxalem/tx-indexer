import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2 } from "lucide-react";

function formatBalance(value: number, decimals: number = 2): string {
  if (value === 0) return "0";
  if (value < 0.01) return value.toFixed(Math.min(decimals, 6));
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string | null;
  balance: number;
  isLoadingBalance: boolean;
  insufficientBalance: boolean;
  /** Token symbol to display (defaults to USDC) */
  tokenSymbol?: string;
  /** Token decimals for balance formatting */
  tokenDecimals?: number;
  /** Optional token selector to render inside the input */
  tokenSelector?: ReactNode;
}

export function AmountInput({
  value,
  onChange,
  onBlur,
  error,
  balance,
  isLoadingBalance,
  insufficientBalance,
  tokenSymbol = "USDC",
  tokenDecimals = 6,
  tokenSelector,
}: AmountInputProps) {
  const amountNum = parseFloat(value) || 0;
  const remainingBalance = amountNum > 0 ? balance - amountNum : balance;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          amount
        </label>
        <span
          className={cn(
            "text-xs",
            insufficientBalance
              ? "text-red-500"
              : "text-neutral-500 dark:text-neutral-400",
          )}
        >
          {isLoadingBalance ? (
            <Loader2 className="h-3 w-3 animate-spin inline" />
          ) : (
            <>
              balance:{" "}
              <span className="font-mono">
                {formatBalance(remainingBalance, tokenDecimals)} {tokenSymbol}
              </span>
            </>
          )}
        </span>
      </div>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "" || /^\d*\.?\d*$/.test(val)) {
              onChange(val);
            }
          }}
          onBlur={onBlur}
          placeholder="0.00"
          className={cn(
            "w-full pl-4 pr-24 py-4 rounded-lg border bg-white dark:bg-neutral-800 font-mono text-2xl text-neutral-900 dark:text-neutral-100 transition-colors",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-vibrant-red focus-visible:border-vibrant-red",
            error
              ? "border-red-400 dark:border-red-700"
              : "border-neutral-200 dark:border-neutral-700",
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {tokenSelector || (
            <span className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
              {tokenSymbol}
            </span>
          )}
        </div>
      </div>
      <div className="h-5 mt-1">
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

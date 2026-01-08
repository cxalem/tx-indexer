import { cn } from "@/lib/utils";
import { AlertCircle, Loader2 } from "lucide-react";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string | null;
  balance: number;
  isLoadingBalance: boolean;
  insufficientBalance: boolean;
}

export function AmountInput({
  value,
  onChange,
  onBlur,
  error,
  balance,
  isLoadingBalance,
  insufficientBalance,
}: AmountInputProps) {
  const amountNum = parseFloat(value) || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-neutral-500">amount</label>
        <span
          className={cn(
            "text-xs",
            insufficientBalance ? "text-red-500" : "text-neutral-500",
          )}
        >
          {isLoadingBalance ? (
            <Loader2 className="h-3 w-3 animate-spin inline" />
          ) : (
            <>
              balance:{" "}
              <span className="font-mono">
                {formatUsd(amountNum > 0 ? balance - amountNum : balance)}
              </span>
            </>
          )}
        </span>
      </div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-neutral-400 font-medium">
          $
        </span>
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
            "w-full pl-10 pr-16 py-4 rounded-lg border bg-white font-mono text-2xl transition-colors",
            "focus:outline-none focus:border-vibrant-red",
            error ? "border-red-400" : "border-neutral-200",
          )}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500 font-medium">
          USDC
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

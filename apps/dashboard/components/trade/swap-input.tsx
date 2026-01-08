import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { TokenSelector } from "@/components/token-selector";
import type { SwapToken } from "@/lib/swap-tokens";

interface SwapInputProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  balance: number | null;
  token: SwapToken;
  tokens: SwapToken[];
  onTokenChange: (token: SwapToken) => void;
  hasError?: boolean;
  isOutput?: boolean;
  isLoading?: boolean;
  onMaxClick?: () => void;
}

export function SwapInput({
  label,
  value,
  onChange,
  balance,
  token,
  tokens,
  onTokenChange,
  hasError = false,
  isOutput = false,
  isLoading = false,
  onMaxClick,
}: SwapInputProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 p-4",
        isOutput && "bg-neutral-50",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-neutral-500">{label}</p>
        {balance !== null && !isOutput && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs",
                hasError ? "text-red-500" : "text-neutral-500",
              )}
            >
              balance:{" "}
              <span className="font-mono">
                {balance.toFixed(token.symbol === "SOL" ? 4 : 2)}
              </span>
            </span>
            {onMaxClick && (
              <button
                type="button"
                onClick={onMaxClick}
                className="text-xs font-medium text-vibrant-red hover:text-vibrant-red/80 transition-colors"
              >
                MAX
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {isOutput ? (
          <div className="flex-1 text-2xl font-mono text-neutral-700">
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            ) : value ? (
              value
            ) : (
              <span className="text-neutral-400">0.00</span>
            )}
          </div>
        ) : (
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^\d*\.?\d*$/.test(val)) {
                onChange?.(val);
              }
            }}
            placeholder="0.00"
            className={cn(
              "flex-1 min-w-0 text-2xl font-mono bg-transparent outline-none",
              hasError && "text-red-500",
            )}
          />
        )}
        <TokenSelector
          selectedToken={token}
          tokens={tokens}
          onSelect={onTokenChange}
        />
      </div>
      {hasError && !isOutput && (
        <p className="text-xs text-red-500 mt-2">Insufficient balance</p>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import type { SwapToken } from "@/lib/swap-tokens";

interface QuoteDisplayProps {
  quote: {
    inAmount: string;
    outAmount: string;
    priceImpactPct: string;
  };
  inputToken: SwapToken;
  outputToken: SwapToken;
  quoteSecondsRemaining: number;
  isQuoteExpired: boolean;
  onRefresh: () => void;
}

export function QuoteDisplay({
  quote,
  inputToken,
  outputToken,
  quoteSecondsRemaining,
  isQuoteExpired,
  onRefresh,
}: QuoteDisplayProps) {
  const rate =
    parseFloat(quote.outAmount) /
    Math.pow(10, outputToken.decimals) /
    (parseFloat(quote.inAmount) / Math.pow(10, inputToken.decimals));

  return (
    <div className="text-center py-2">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        1 {inputToken.symbol} ≈{" "}
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {rate.toFixed(inputToken.symbol === "SOL" ? 2 : 6)}{" "}
          {outputToken.symbol}
        </span>
      </p>
      <div className="flex items-center justify-center gap-2 mt-1">
        {isQuoteExpired ? (
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Quote expired - click to refresh
          </button>
        ) : (
          <span
            className={cn(
              "text-xs",
              quoteSecondsRemaining <= 10
                ? "text-amber-600 dark:text-amber-500"
                : "text-neutral-400 dark:text-neutral-500",
            )}
          >
            Quote updates in {quoteSecondsRemaining}s
          </span>
        )}
      </div>
    </div>
  );
}

interface PriceImpactWarningProps {
  priceImpact: number;
}

export function PriceImpactWarning({ priceImpact }: PriceImpactWarningProps) {
  if (priceImpact <= 1) return null;

  return (
    <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
      <p className="text-sm text-amber-700 dark:text-amber-400">
        This trade may result in less tokens than expected due to low liquidity.
        Consider trading a smaller amount.
      </p>
    </div>
  );
}

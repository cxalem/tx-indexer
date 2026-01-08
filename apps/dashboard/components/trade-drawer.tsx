"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/react-hooks";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  ArrowUpDown,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useSwap, formatSwapOutput } from "@/hooks/use-swap";
import {
  SWAP_TOKENS,
  SOL_MINT,
  getValidOutputTokens,
  type SwapToken,
} from "@/lib/swap-tokens";
import { TokenSelector } from "@/components/token-selector";

interface TokenBalance {
  mint: string;
  symbol: string;
  uiAmount: number;
}

interface TradeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTradeSuccess?: () => void;
  /** SOL balance (UI amount) */
  solBalance?: number | null;
  /** Token balances from dashboard data */
  tokenBalances?: TokenBalance[];
}

export function TradeDrawer({
  open,
  onOpenChange,
  onTradeSuccess,
  solBalance,
  tokenBalances = [],
}: TradeDrawerProps) {
  const wallet = useWallet();
  const {
    status,
    isSwapping,
    quote,
    isQuoting,
    signature,
    error: swapError,
    quoteSecondsRemaining,
    isQuoteExpired,
    getQuote,
    executeSwap,
    reset,
    refreshQuote,
  } = useSwap();

  const isConnected = wallet.status === "connected";

  // Token selection state - SOL and USDC as defaults
  const [inputToken, setInputToken] = useState<SwapToken>(SWAP_TOKENS[0]!); // SOL
  const [outputToken, setOutputToken] = useState<SwapToken>(SWAP_TOKENS[1]!); // USDC
  const [inputAmount, setInputAmount] = useState("");

  // Get balance for the selected input token
  const getTokenBalance = (mint: string): number | null => {
    if (mint === SOL_MINT) {
      return solBalance ?? null;
    }
    const tokenBal = tokenBalances.find((t) => t.mint === mint);
    return tokenBal?.uiAmount ?? null;
  };

  const inputBalance = getTokenBalance(inputToken.mint);

  // Debounce timer for quote fetching
  const quoteDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Get valid output tokens for current input
  const validOutputTokens = getValidOutputTokens(inputToken.mint);

  // Ensure output token is valid when input changes
  useEffect(() => {
    if (!validOutputTokens.find((t) => t.mint === outputToken.mint)) {
      const fallback = validOutputTokens[0] ?? SWAP_TOKENS[1];
      if (fallback) {
        setOutputToken(fallback);
      }
    }
  }, [inputToken, validOutputTokens, outputToken.mint]);

  // Fetch quote when input changes
  useEffect(() => {
    if (quoteDebounceRef.current) {
      clearTimeout(quoteDebounceRef.current);
    }

    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0 || !inputToken || !outputToken) {
      return;
    }

    quoteDebounceRef.current = setTimeout(() => {
      getQuote(inputToken.mint, outputToken.mint, amount, inputToken.decimals);
    }, 500);

    return () => {
      if (quoteDebounceRef.current) {
        clearTimeout(quoteDebounceRef.current);
      }
    };
  }, [inputAmount, inputToken, outputToken, getQuote]);

  // Swap direction
  const handleSwapDirection = useCallback(() => {
    const newInput = outputToken;
    const newOutput = inputToken;
    setInputToken(newInput);
    setOutputToken(newOutput);
    setInputAmount("");
  }, [inputToken, outputToken]);

  // Handle input token change
  const handleInputTokenChange = useCallback((token: SwapToken) => {
    setInputToken(token);
    setInputAmount("");
  }, []);

  // Handle output token change
  const handleOutputTokenChange = useCallback((token: SwapToken) => {
    setOutputToken(token);
  }, []);

  // Handle swap execution
  const handleSwap = useCallback(async () => {
    const result = await executeSwap(inputBalance);
    if (result.signature) {
      onTradeSuccess?.();
    }
  }, [executeSwap, onTradeSuccess, inputBalance]);

  // Reset form
  const handleReset = useCallback(() => {
    reset();
    setInputAmount("");
  }, [reset]);

  // Close drawer
  const handleClose = useCallback(() => {
    handleReset();
    onOpenChange(false);
  }, [handleReset, onOpenChange]);

  // Calculate output amount
  const outputAmount = quote
    ? formatSwapOutput(quote.outAmount, outputToken)
    : "";

  // Price impact warning
  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;
  const highPriceImpact = priceImpact > 1; // > 1% is considered high

  // Show result state
  const showResultState = status === "success" || status === "error";

  // Check if user has insufficient balance
  const amount = parseFloat(inputAmount);
  const hasInsufficientBalance =
    inputBalance !== null && amount > 0 && amount > inputBalance;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-vibrant-red/10">
              <ArrowLeftRight className="h-4 w-4 text-vibrant-red" />
            </div>
            trade
          </SheetTitle>
          <SheetDescription>Swap tokens instantly</SheetDescription>
        </SheetHeader>

        {/* Swap in progress overlay */}
        {isSwapping && (
          <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-vibrant-red mb-4" />
            <p className="text-sm font-medium text-neutral-700">
              {status === "signing" && "Please sign in your wallet..."}
              {status === "confirming" && "Confirming transaction..."}
            </p>
          </div>
        )}

        {/* Success state */}
        {status === "success" && signature && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Trade complete!
            </h3>
            <p className="text-sm text-neutral-500 text-center mb-4">
              Swapped {inputAmount} {inputToken.symbol} for {outputAmount}{" "}
              {outputToken.symbol}
            </p>
            <a
              href={`https://solscan.io/tx/${signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-vibrant-red hover:underline flex items-center gap-1 mb-6"
            >
              View transaction
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 rounded-lg bg-vibrant-red text-white text-sm font-medium hover:bg-vibrant-red/90 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-2">
              Trade failed
            </h3>
            <p className="text-sm text-neutral-500 text-center mb-6">
              {swapError || "Something went wrong. Please try again."}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 rounded-lg bg-vibrant-red text-white text-sm font-medium hover:bg-vibrant-red/90 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Swap form */}
        {!showResultState && (
          <div className="flex flex-col flex-1 mt-6">
            <div className="space-y-4 flex-1">
              {/* You pay section */}
              <div className="rounded-lg border border-neutral-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-neutral-500">you pay</p>
                  {inputBalance !== null && (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs",
                          hasInsufficientBalance
                            ? "text-red-500"
                            : "text-neutral-500",
                        )}
                      >
                        balance:{" "}
                        <span className="font-mono">
                          {inputBalance.toFixed(
                            inputToken.symbol === "SOL" ? 4 : 2,
                          )}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          // Leave a small amount for fees if SOL
                          const maxAmount =
                            inputToken.symbol === "SOL"
                              ? Math.max(0, inputBalance - 0.01)
                              : inputBalance;
                          setInputAmount(maxAmount.toString());
                        }}
                        className="text-xs font-medium text-vibrant-red hover:text-vibrant-red/80 transition-colors"
                      >
                        MAX
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^\d*\.?\d*$/.test(value)) {
                        setInputAmount(value);
                      }
                    }}
                    placeholder="0.00"
                    className={cn(
                      "flex-1 min-w-0 text-2xl font-mono bg-transparent outline-none",
                      hasInsufficientBalance && "text-red-500",
                    )}
                  />
                  <TokenSelector
                    selectedToken={inputToken}
                    tokens={SWAP_TOKENS}
                    onSelect={handleInputTokenChange}
                  />
                </div>
                {hasInsufficientBalance && (
                  <p className="text-xs text-red-500 mt-2">
                    Insufficient balance
                  </p>
                )}
              </div>

              {/* Swap direction button */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  type="button"
                  onClick={handleSwapDirection}
                  className="p-2 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
                >
                  <ArrowUpDown className="h-4 w-4 text-neutral-500" />
                </button>
              </div>

              {/* You receive section */}
              <div className="rounded-lg border border-neutral-200 p-4 bg-neutral-50">
                <p className="text-xs text-neutral-500 mb-2">you receive</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-2xl font-mono text-neutral-700">
                    {isQuoting ? (
                      <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                    ) : outputAmount ? (
                      outputAmount
                    ) : (
                      <span className="text-neutral-400">0.00</span>
                    )}
                  </div>
                  <TokenSelector
                    selectedToken={outputToken}
                    tokens={validOutputTokens}
                    onSelect={handleOutputTokenChange}
                  />
                </div>
              </div>

              {/* Rate display with expiration */}
              {quote && (
                <div className="text-center py-2">
                  <p className="text-sm text-neutral-500">
                    1 {inputToken.symbol} ≈{" "}
                    <span className="font-medium text-neutral-700">
                      {(
                        parseFloat(quote.outAmount) /
                        Math.pow(10, outputToken.decimals) /
                        (parseFloat(quote.inAmount) /
                          Math.pow(10, inputToken.decimals))
                      ).toFixed(inputToken.symbol === "SOL" ? 2 : 6)}{" "}
                      {outputToken.symbol}
                    </span>
                  </p>
                  {/* Quote expiration indicator */}
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {isQuoteExpired ? (
                      <button
                        type="button"
                        onClick={refreshQuote}
                        className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Quote expired - click to refresh
                      </button>
                    ) : (
                      <span
                        className={cn(
                          "text-xs",
                          quoteSecondsRemaining <= 10
                            ? "text-amber-600"
                            : "text-neutral-400",
                        )}
                      >
                        Quote updates in {quoteSecondsRemaining}s
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Warning only for high price impact - beginner friendly message */}
              {quote && highPriceImpact && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-sm text-amber-700">
                    This trade may result in less tokens than expected due to
                    low liquidity. Consider trading a smaller amount.
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-neutral-200">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={handleSwap}
                disabled={
                  !isConnected ||
                  isSwapping ||
                  isQuoting ||
                  !quote ||
                  !inputAmount ||
                  isQuoteExpired ||
                  hasInsufficientBalance
                }
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  isConnected &&
                    quote &&
                    inputAmount &&
                    !isSwapping &&
                    !isQuoting &&
                    !isQuoteExpired &&
                    !hasInsufficientBalance
                    ? "bg-vibrant-red text-white hover:bg-vibrant-red/90"
                    : "bg-neutral-200 text-neutral-400 cursor-not-allowed",
                )}
              >
                <ArrowLeftRight className="h-4 w-4" />
                trade
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ArrowLeftRight, ArrowUpDown, AlertCircle } from "lucide-react";
import { useSwap, formatSwapOutput } from "@/hooks/use-swap";
import {
  SWAP_TOKENS,
  SOL_MINT,
  getValidOutputTokens,
  type SwapToken,
} from "@/lib/swap-tokens";

import { SwappingOverlay, TradeSuccess, TradeError } from "./trade-states";
import { SwapInput } from "./swap-input";
import { QuoteDisplay, PriceImpactWarning } from "./quote-display";

interface TokenBalance {
  mint: string;
  symbol: string;
  uiAmount: number;
}

interface TradeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTradeSuccess?: () => void;
  solBalance?: number | null;
  tokenBalances?: TokenBalance[];
  /** Pre-select input token by mint address */
  initialInputMint?: string | null;
}

export function TradeDrawer({
  open,
  onOpenChange,
  onTradeSuccess,
  solBalance,
  tokenBalances = [],
  initialInputMint,
}: TradeDrawerProps) {
  const {
    status: walletStatus,
    address: walletAddress,
    connectionType,
  } = useUnifiedWallet();
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

  const isConnected = walletStatus === "connected";
  const isMobileDeepLink = connectionType === "mobile";

  const [inputToken, setInputToken] = useState<SwapToken>(SWAP_TOKENS[0]!);
  const [outputToken, setOutputToken] = useState<SwapToken>(SWAP_TOKENS[1]!);
  const [inputAmount, setInputAmount] = useState("");

  // Set initial input token when drawer opens with a specific token
  useEffect(() => {
    if (open && initialInputMint) {
      const token = SWAP_TOKENS.find((t) => t.mint === initialInputMint);
      if (token) {
        setInputToken(token);
      }
    }
  }, [open, initialInputMint]);

  const getTokenBalance = (mint: string): number | null => {
    if (mint === SOL_MINT) return solBalance ?? null;
    const tokenBal = tokenBalances.find((t) => t.mint === mint);
    return tokenBal?.uiAmount ?? null;
  };

  const inputBalance = getTokenBalance(inputToken.mint);
  const quoteDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const validOutputTokens = getValidOutputTokens(inputToken.mint);

  useEffect(() => {
    if (!validOutputTokens.find((t) => t.mint === outputToken.mint)) {
      const fallback = validOutputTokens[0] ?? SWAP_TOKENS[1];
      if (fallback) setOutputToken(fallback);
    }
  }, [inputToken, validOutputTokens, outputToken.mint]);

  useEffect(() => {
    if (quoteDebounceRef.current) clearTimeout(quoteDebounceRef.current);

    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0 || !inputToken || !outputToken) return;

    quoteDebounceRef.current = setTimeout(() => {
      getQuote(inputToken.mint, outputToken.mint, amount, inputToken.decimals);
    }, 500);

    return () => {
      if (quoteDebounceRef.current) clearTimeout(quoteDebounceRef.current);
    };
  }, [inputAmount, inputToken, outputToken, getQuote]);

  const handleSwapDirection = useCallback(() => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount("");
  }, [inputToken, outputToken]);

  const handleSwap = useCallback(async () => {
    const result = await executeSwap(inputBalance);
    if (result.signature) onTradeSuccess?.();
  }, [executeSwap, onTradeSuccess, inputBalance]);

  const handleReset = useCallback(() => {
    reset();
    setInputAmount("");
  }, [reset]);

  const handleClose = useCallback(() => {
    handleReset();
    onOpenChange(false);
  }, [handleReset, onOpenChange]);

  const outputAmount = quote
    ? formatSwapOutput(quote.outAmount, outputToken)
    : "";

  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;
  const showResultState = status === "success" || status === "error";
  const amount = parseFloat(inputAmount);
  const hasInsufficientBalance =
    inputBalance !== null && amount > 0 && amount > inputBalance;

  const canTrade =
    isConnected &&
    !isMobileDeepLink &&
    quote &&
    inputAmount &&
    !isSwapping &&
    !isQuoting &&
    !isQuoteExpired &&
    !hasInsufficientBalance;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-vibrant-red/10">
              <ArrowLeftRight
                className="h-4 w-4 text-vibrant-red"
                aria-hidden="true"
              />
            </div>
            trade
          </SheetTitle>
          <SheetDescription>Swap tokens instantly</SheetDescription>
        </SheetHeader>

        {isSwapping && <SwappingOverlay status={status} />}

        {status === "success" && signature && (
          <TradeSuccess
            inputAmount={inputAmount}
            inputSymbol={inputToken.symbol}
            outputAmount={outputAmount}
            outputSymbol={outputToken.symbol}
            signature={signature}
            walletAddress={walletAddress}
            onClose={handleClose}
          />
        )}

        {status === "error" && (
          <TradeError
            error={swapError}
            onClose={handleClose}
            onRetry={handleReset}
          />
        )}

        {!showResultState && (
          <div className="flex flex-col flex-1 mt-6">
            <div className="space-y-4 flex-1">
              <SwapInput
                label="you pay"
                value={inputAmount}
                onChange={setInputAmount}
                balance={inputBalance}
                token={inputToken}
                tokens={SWAP_TOKENS}
                onTokenChange={(token) => {
                  setInputToken(token);
                  setInputAmount("");
                }}
                hasError={hasInsufficientBalance}
                onMaxClick={() => {
                  if (inputBalance !== null) {
                    const maxAmount =
                      inputToken.symbol === "SOL"
                        ? Math.max(0, inputBalance - 0.01)
                        : inputBalance;
                    setInputAmount(maxAmount.toString());
                  }
                }}
              />

              <div className="flex justify-center -my-2 relative z-10">
                <button
                  type="button"
                  onClick={handleSwapDirection}
                  aria-label="Swap token direction"
                  className="p-2 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  <ArrowUpDown
                    className="h-4 w-4 text-neutral-500 dark:text-neutral-400"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <SwapInput
                label="you receive"
                value={outputAmount}
                balance={null}
                token={outputToken}
                tokens={validOutputTokens}
                onTokenChange={setOutputToken}
                isOutput
                isLoading={isQuoting}
              />

              {quote && (
                <QuoteDisplay
                  quote={quote}
                  inputToken={inputToken}
                  outputToken={outputToken}
                  quoteSecondsRemaining={quoteSecondsRemaining}
                  isQuoteExpired={isQuoteExpired}
                  onRefresh={refreshQuote}
                />
              )}

              {quote && <PriceImpactWarning priceImpact={priceImpact} />}

              {isMobileDeepLink && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle
                    className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Trading is not yet supported via mobile deep links. Use
                    &quot;Open in wallet browser&quot; for full functionality.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6 pt-4 pb-4 sm:pb-0 border-t border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={handleSwap}
                disabled={!canTrade}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  canTrade
                    ? "bg-vibrant-red text-white hover:bg-vibrant-red/90 cursor-pointer"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed",
                )}
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                trade
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

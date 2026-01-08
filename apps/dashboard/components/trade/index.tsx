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
import { ArrowLeftRight, ArrowUpDown } from "lucide-react";
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
  const walletAddress = isConnected
    ? wallet.session.account.address.toString()
    : null;

  const [inputToken, setInputToken] = useState<SwapToken>(SWAP_TOKENS[0]!);
  const [outputToken, setOutputToken] = useState<SwapToken>(SWAP_TOKENS[1]!);
  const [inputAmount, setInputAmount] = useState("");

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
              <ArrowLeftRight className="h-4 w-4 text-vibrant-red" />
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
                  className="p-2 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
                >
                  <ArrowUpDown className="h-4 w-4 text-neutral-500" />
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
            </div>

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
                disabled={!canTrade}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  canTrade
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

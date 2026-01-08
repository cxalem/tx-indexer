"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet, useWaitForSignature } from "@solana/react-hooks";
import {
  isValidSwapPair,
  toRawAmount,
  toUiAmount,
  type SwapToken,
} from "@/lib/swap-tokens";
import {
  JUPITER_CONFIG,
  isQuoteValid,
  getQuoteTimeRemaining,
  type JupiterQuoteResponse,
} from "@/lib/jupiter";
import {
  signAndSendTransaction,
  getDetectedWalletName,
} from "@/lib/wallet-transactions";

// Use our own API routes to proxy Jupiter requests (avoids CORS issues)
const JUPITER_QUOTE_API = "/api/swap/quote";
const JUPITER_SWAP_API = "/api/swap/transaction";

export type SwapStatus =
  | "idle"
  | "quoting"
  | "ready"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routePlan: JupiterQuoteResponse["routePlan"];
  rawQuote: JupiterQuoteResponse;
  timestamp: number; // When the quote was fetched
}

export interface UseSwapReturn {
  status: SwapStatus;
  isSwapping: boolean;
  quote: SwapQuote | null;
  isQuoting: boolean;
  signature: string | null;
  error: string | null;
  /** Seconds remaining until quote expires */
  quoteSecondsRemaining: number;
  /** Whether the current quote is expired */
  isQuoteExpired: boolean;
  getQuote: (
    inputMint: string,
    outputMint: string,
    amount: number,
    inputDecimals: number,
  ) => Promise<void>;
  executeSwap: (inputBalance?: number | null) => Promise<{
    signature: string | null;
    error: string | null;
  }>;
  reset: () => void;
  /** Refresh the current quote */
  refreshQuote: () => Promise<void>;
}

export function useSwap(): UseSwapReturn {
  const wallet = useWallet();
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);
  const [quoteSecondsRemaining, setQuoteSecondsRemaining] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastQuoteParamsRef = useRef<{
    inputMint: string;
    outputMint: string;
    amount: number;
    inputDecimals: number;
  } | null>(null);

  const { confirmationStatus } = useWaitForSignature(
    currentSignature ?? undefined,
    {
      disabled: !currentSignature,
      commitment: "confirmed",
    },
  );

  // Update quote expiration countdown
  useEffect(() => {
    if (!quote) {
      setQuoteSecondsRemaining(0);
      return;
    }

    const updateRemaining = () => {
      setQuoteSecondsRemaining(getQuoteTimeRemaining(quote.timestamp));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [quote]);

  // Check if quote is expired
  const isQuoteExpired = quote ? !isQuoteValid(quote.timestamp) : false;

  useEffect(() => {
    if (
      currentSignature &&
      confirmationStatus === "confirmed" &&
      status === "confirming"
    ) {
      setStatus("success");
    }
  }, [currentSignature, confirmationStatus, status]);

  const getQuote = useCallback(
    async (
      inputMint: string,
      outputMint: string,
      amount: number,
      inputDecimals: number,
    ) => {
      if (!isValidSwapPair(inputMint, outputMint)) {
        setError("Invalid swap pair");
        setStatus("error");
        return;
      }

      // Store params for refresh
      lastQuoteParamsRef.current = {
        inputMint,
        outputMint,
        amount,
        inputDecimals,
      };

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setError(null);
      setQuote(null);
      setStatus("quoting");

      try {
        const rawAmount = toRawAmount(amount, inputDecimals);

        const params = new URLSearchParams({
          inputMint,
          outputMint,
          amount: rawAmount.toString(),
        });

        const url = `${JUPITER_QUOTE_API}?${params}`;

        const response = await fetch(url, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData: { error?: string } = {};
          try {
            errorData = JSON.parse(errorText);
          } catch {
            // Not JSON
          }
          throw new Error(
            errorData.error || `Quote failed: ${response.status}`,
          );
        }

        const quoteResponse: JupiterQuoteResponse = await response.json();

        setQuote({
          inputMint: quoteResponse.inputMint,
          outputMint: quoteResponse.outputMint,
          inAmount: quoteResponse.inAmount,
          outAmount: quoteResponse.outAmount,
          otherAmountThreshold: quoteResponse.otherAmountThreshold,
          priceImpactPct: quoteResponse.priceImpactPct,
          routePlan: quoteResponse.routePlan || [],
          rawQuote: quoteResponse,
          timestamp: Date.now(),
        });
        setStatus("ready");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : "Failed to get quote";
        setError(errorMessage);
        setStatus("error");
      }
    },
    [],
  );

  const refreshQuote = useCallback(async () => {
    if (!lastQuoteParamsRef.current) return;
    const { inputMint, outputMint, amount, inputDecimals } =
      lastQuoteParamsRef.current;
    await getQuote(inputMint, outputMint, amount, inputDecimals);
  }, [getQuote]);

  const executeSwap = useCallback(
    async (
      inputBalance?: number | null,
    ): Promise<{
      signature: string | null;
      error: string | null;
    }> => {
      if (wallet.status !== "connected") {
        setError("Wallet not connected");
        setStatus("error");
        return { signature: null, error: "Wallet not connected" };
      }

      if (!quote) {
        setError("No quote available");
        setStatus("error");
        return { signature: null, error: "No quote available" };
      }

      // Check if quote is expired
      if (!isQuoteValid(quote.timestamp)) {
        setError("Quote expired. Please refresh and try again.");
        setStatus("error");
        return { signature: null, error: "Quote expired" };
      }

      // Validate balance if provided
      if (inputBalance !== undefined && inputBalance !== null) {
        const requiredAmount = toUiAmount(
          BigInt(quote.inAmount),
          lastQuoteParamsRef.current?.inputDecimals ?? 9,
        );
        if (inputBalance < requiredAmount) {
          setError("Insufficient balance");
          setStatus("error");
          return { signature: null, error: "Insufficient balance" };
        }
      }

      setError(null);
      setCurrentSignature(null);
      setStatus("signing");

      try {
        const walletAddress = wallet.session.account.address.toString();
        const detectedWallet = getDetectedWalletName();

        // Get swap transaction from Jupiter
        const swapResponse = await fetch(JUPITER_SWAP_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteResponse: quote.rawQuote,
            userPublicKey: walletAddress,
          }),
        });

        if (!swapResponse.ok) {
          const errorText = await swapResponse.text();
          let errorData: { error?: string } = {};
          try {
            errorData = JSON.parse(errorText);
          } catch {
            // Not JSON
          }
          throw new Error(
            errorData.error ||
              `Jupiter API error: ${swapResponse.status} - ${errorText.slice(0, 100)}`,
          );
        }

        const swapData = await swapResponse.json();

        if (!swapData.swapTransaction) {
          throw new Error("Jupiter API did not return a swap transaction");
        }

        // Decode the base64 transaction to Uint8Array
        const transactionBytes = Uint8Array.from(
          atob(swapData.swapTransaction),
          (c) => c.charCodeAt(0),
        );

        // Sign and send using wallet-agnostic utility
        const txSignature = await signAndSendTransaction(transactionBytes);

        setCurrentSignature(txSignature);
        setStatus("confirming");

        return { signature: txSignature, error: null };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Swap failed";
        setError(errorMessage);
        setStatus("error");
        return { signature: null, error: errorMessage };
      }
    },
    [wallet, quote],
  );

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus("idle");
    setQuote(null);
    setError(null);
    setCurrentSignature(null);
    lastQuoteParamsRef.current = null;
  }, []);

  return {
    status,
    isSwapping: status === "signing" || status === "confirming",
    quote,
    isQuoting: status === "quoting",
    signature: currentSignature,
    error,
    quoteSecondsRemaining,
    isQuoteExpired,
    getQuote,
    executeSwap,
    reset,
    refreshQuote,
  };
}

export function formatSwapOutput(
  outAmount: string | undefined,
  outputToken: SwapToken | undefined,
): string {
  if (!outAmount || !outputToken) return "0";
  const uiAmount = toUiAmount(BigInt(outAmount), outputToken.decimals);
  if (outputToken.symbol === "SOL") {
    return uiAmount.toFixed(6);
  }
  return uiAmount.toFixed(2);
}

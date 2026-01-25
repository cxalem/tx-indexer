"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Keypair, Connection, VersionedTransaction } from "@solana/web3.js";
import { PrivacyCashClient } from "@/lib/privacy/privacy-cash-client";
import {
  createEphemeralKeypair,
  waitForBalance,
  getEphemeralTokenBalance,
  isBalanceSufficientForSwap,
} from "@/lib/privacy/ephemeral-wallet";
import {
  PRIVACY_CASH_SUPPORTED_TOKENS,
  type PrivacyCashToken,
} from "@/lib/privacy/constants";

const JUPITER_QUOTE_API = "/api/swap/quote";
const JUPITER_SWAP_API = "/api/swap/transaction";

const SOL_MINT = "So11111111111111111111111111111111111111112";

const TOKEN_MINTS: Record<PrivacyCashToken, string> = {
  SOL: SOL_MINT,
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

export type PrivateSwapStep =
  | "idle"
  | "initializing"
  | "withdrawing"
  | "waiting_funds"
  | "quoting"
  | "swapping"
  | "confirming_swap"
  | "depositing"
  | "confirming_deposit"
  | "success"
  | "error";

export interface PrivateSwapState {
  step: PrivateSwapStep;
  error: string | null;
  fromToken: PrivacyCashToken;
  toToken: PrivacyCashToken;
  inputAmount: string;
  outputAmount: string;
  withdrawSignature: string | null;
  swapSignature: string | null;
  depositSignature: string | null;
}

export interface UsePrivateSwapReturn {
  state: PrivateSwapState;
  isSwapping: boolean;
  estimatedOutput: string;
  isLoadingQuote: boolean;
  isBelowMinimum: boolean;
  minimumAmount: number;
  executeSwap: (
    client: PrivacyCashClient,
    fromToken: PrivacyCashToken,
    toToken: PrivacyCashToken,
    amount: number,
  ) => Promise<void>;
  getQuote: (
    fromToken: PrivacyCashToken,
    toToken: PrivacyCashToken,
    amount: number,
  ) => Promise<void>;
  reset: () => void;
}

const INITIAL_STATE: PrivateSwapState = {
  step: "idle",
  error: null,
  fromToken: "SOL",
  toToken: "USDC",
  inputAmount: "",
  outputAmount: "",
  withdrawSignature: null,
  swapSignature: null,
  depositSignature: null,
};

const MINIMUM_SWAP_AMOUNT = 0.01;
const MAX_DEPOSIT_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUserRejection(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("user rejected") || msg.includes("rejected");
}

export function usePrivateSwap(): UsePrivateSwapReturn {
  const [state, setState] = useState<PrivateSwapState>(INITIAL_STATE);
  const [estimatedOutput, setEstimatedOutput] = useState("");
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [currentAmount, setCurrentAmount] = useState(0);

  const quoteAbortRef = useRef<AbortController | null>(null);
  const quoteIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isBelowMinimum =
    currentAmount > 0 && currentAmount < MINIMUM_SWAP_AMOUNT;

  useEffect(() => {
    return () => {
      if (quoteAbortRef.current) quoteAbortRef.current.abort();
      if (quoteIntervalRef.current) clearInterval(quoteIntervalRef.current);
    };
  }, []);

  const getQuote = useCallback(
    async (
      fromToken: PrivacyCashToken,
      toToken: PrivacyCashToken,
      amount: number,
    ) => {
      if (quoteAbortRef.current) quoteAbortRef.current.abort();
      if (quoteIntervalRef.current) clearInterval(quoteIntervalRef.current);

      if (!amount || amount <= 0) {
        setEstimatedOutput("");
        setCurrentAmount(0);
        return;
      }

      setCurrentAmount(amount);

      if (!isBalanceSufficientForSwap(amount)) {
        setEstimatedOutput("");
        return;
      }

      const fetchQuote = async () => {
        const controller = new AbortController();
        quoteAbortRef.current = controller;

        setIsLoadingQuote(true);

        try {
          const inputMint = TOKEN_MINTS[fromToken];
          const outputMint = TOKEN_MINTS[toToken];
          const decimals = PRIVACY_CASH_SUPPORTED_TOKENS[fromToken].decimals;
          const rawAmount = Math.floor(amount * Math.pow(10, decimals));

          const params = new URLSearchParams({
            inputMint,
            outputMint,
            amount: rawAmount.toString(),
          });

          const response = await fetch(`${JUPITER_QUOTE_API}?${params}`, {
            signal: controller.signal,
          });

          if (!response.ok) throw new Error("Failed to get quote");

          const quoteData = await response.json();
          const outputDecimals =
            PRIVACY_CASH_SUPPORTED_TOKENS[toToken].decimals;
          const outputAmount =
            parseInt(quoteData.outAmount) / Math.pow(10, outputDecimals);

          setEstimatedOutput(outputAmount.toFixed(toToken === "SOL" ? 6 : 2));
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          setEstimatedOutput("");
        } finally {
          setIsLoadingQuote(false);
        }
      };

      await fetchQuote();

      quoteIntervalRef.current = setInterval(fetchQuote, 15000);
    },
    [],
  );

  const executeSwap = useCallback(
    async (
      client: PrivacyCashClient,
      fromToken: PrivacyCashToken,
      toToken: PrivacyCashToken,
      amount: number,
    ) => {
      if (quoteIntervalRef.current) {
        clearInterval(quoteIntervalRef.current);
        quoteIntervalRef.current = null;
      }

      let ephemeralKeypair: Keypair | null = null;

      setState((s) => ({
        ...s,
        step: "initializing",
        error: null,
        fromToken,
        toToken,
        inputAmount: amount.toString(),
        outputAmount: "",
        withdrawSignature: null,
        swapSignature: null,
        depositSignature: null,
      }));

      try {
        if (!client.isInitialized) {
          await client.initialize();
        }

        ephemeralKeypair = createEphemeralKeypair();
        const connection = client.getConnection();

        setState((s) => ({ ...s, step: "withdrawing" }));

        const withdrawResult = await client.withdrawForSwap(
          amount,
          ephemeralKeypair.publicKey,
        );

        setState((s) => ({
          ...s,
          step: "waiting_funds",
          withdrawSignature: withdrawResult.signature,
        }));

        const fundsArrived = await waitForBalance(
          connection,
          ephemeralKeypair.publicKey,
          withdrawResult.netAmount,
          undefined,
          30,
          2000,
        );

        if (!fundsArrived) {
          throw new Error("Withdrawal timed out. Please try again.");
        }

        setState((s) => ({ ...s, step: "quoting" }));

        const inputMint = TOKEN_MINTS[fromToken];
        const outputMint = TOKEN_MINTS[toToken];
        const decimals = PRIVACY_CASH_SUPPORTED_TOKENS[fromToken].decimals;
        const rawAmount = Math.floor(
          withdrawResult.netAmount * Math.pow(10, decimals),
        );

        const quoteParams = new URLSearchParams({
          inputMint,
          outputMint,
          amount: rawAmount.toString(),
        });

        const quoteResponse = await fetch(
          `${JUPITER_QUOTE_API}?${quoteParams}`,
        );
        if (!quoteResponse.ok) throw new Error("Failed to get swap quote");

        const quoteData = await quoteResponse.json();

        setState((s) => ({ ...s, step: "swapping" }));

        const swapResponse = await fetch(JUPITER_SWAP_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteResponse: quoteData,
            userPublicKey: ephemeralKeypair.publicKey.toString(),
          }),
        });

        if (!swapResponse.ok)
          throw new Error("Failed to build swap transaction");

        const swapData = await swapResponse.json();

        if (!swapData.swapTransaction) {
          throw new Error("No swap transaction returned");
        }

        const transactionBytes = Uint8Array.from(
          atob(swapData.swapTransaction),
          (c) => c.charCodeAt(0),
        );

        const transaction = VersionedTransaction.deserialize(transactionBytes);
        transaction.sign([ephemeralKeypair]);

        const swapSignature = await connection.sendRawTransaction(
          transaction.serialize(),
          { skipPreflight: false, preflightCommitment: "confirmed" },
        );

        setState((s) => ({
          ...s,
          step: "confirming_swap",
          swapSignature,
        }));

        await connection.confirmTransaction(swapSignature, "confirmed");

        const outputDecimals = PRIVACY_CASH_SUPPORTED_TOKENS[toToken].decimals;
        const expectedOutput =
          parseInt(quoteData.outAmount) / Math.pow(10, outputDecimals);

        const outputMintPubkey = new (
          await import("@solana/web3.js")
        ).PublicKey(outputMint);

        const outputArrived = await waitForBalance(
          connection,
          ephemeralKeypair.publicKey,
          expectedOutput,
          outputMint === SOL_MINT ? undefined : outputMintPubkey,
          15,
          2000,
        );

        if (!outputArrived) {
          throw new Error("Swap output not received. Please contact support.");
        }

        const actualOutput =
          outputMint === SOL_MINT
            ? await (
                await import("@/lib/privacy/ephemeral-wallet")
              ).getEphemeralSolBalance(connection, ephemeralKeypair.publicKey)
            : await getEphemeralTokenBalance(
                connection,
                ephemeralKeypair.publicKey,
                outputMintPubkey,
              );

        setState((s) => ({
          ...s,
          step: "depositing",
          outputAmount: actualOutput.toFixed(toToken === "SOL" ? 6 : 2),
        }));

        let depositSuccess = false;
        let depositError: Error | null = null;

        for (let attempt = 0; attempt < MAX_DEPOSIT_RETRIES; attempt++) {
          try {
            const depositResult = await client.depositFromEphemeral(
              actualOutput,
              toToken,
              ephemeralKeypair,
            );

            setState((s) => ({
              ...s,
              step: "confirming_deposit",
              depositSignature: depositResult.signature,
            }));

            await connection.confirmTransaction(
              depositResult.signature,
              "confirmed",
            );

            depositSuccess = true;
            break;
          } catch (err) {
            depositError =
              err instanceof Error ? err : new Error("Deposit failed");
            if (attempt < MAX_DEPOSIT_RETRIES - 1) {
              await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
            }
          }
        }

        if (!depositSuccess) {
          throw new Error(
            "Couldn't return funds to private balance. Your swapped tokens are safe. Please contact support.",
          );
        }

        setState((s) => ({ ...s, step: "success" }));
      } catch (err) {
        const errorMessage = isUserRejection(err)
          ? "You cancelled the request"
          : err instanceof Error
            ? err.message
            : "Swap failed. Your funds are safe.";

        setState((s) => ({
          ...s,
          step: "error",
          error: errorMessage,
        }));
      }
    },
    [],
  );

  const reset = useCallback(() => {
    if (quoteAbortRef.current) quoteAbortRef.current.abort();
    if (quoteIntervalRef.current) clearInterval(quoteIntervalRef.current);
    setState(INITIAL_STATE);
    setEstimatedOutput("");
    setIsLoadingQuote(false);
    setCurrentAmount(0);
  }, []);

  const isSwapping =
    state.step !== "idle" && state.step !== "success" && state.step !== "error";

  return {
    state,
    isSwapping,
    estimatedOutput,
    isLoadingQuote,
    isBelowMinimum,
    minimumAmount: MINIMUM_SWAP_AMOUNT,
    executeSwap,
    getQuote,
    reset,
  };
}

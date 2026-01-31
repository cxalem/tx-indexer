"use client";

import {
  useSplToken,
  useWaitForSignature,
  useTransactionPool,
  useWallet,
} from "@solana/react-hooks";
import { address } from "@solana/kit";
import { useCallback, useState, useEffect } from "react";

// Memo program ID
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export type TransferStatus =
  | "idle"
  | "preparing"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export interface TransferResult {
  signature: string | null;
  error: string | null;
}

export interface UseTokenTransferReturn {
  /** Current token balance (UI amount, e.g., 100.50) */
  balance: number | null;
  /** Whether balance is loading */
  isLoadingBalance: boolean;
  /** Current transfer status */
  status: TransferStatus;
  /** Whether a transfer is in progress */
  isTransferring: boolean;
  /** Last transaction signature */
  signature: string | null;
  /** Last error message */
  error: string | null;
  /** Execute a token transfer with optional memo */
  transfer: (
    recipient: string,
    amount: number,
    memo?: string,
  ) => Promise<TransferResult>;
  /** Reset the transfer state */
  reset: () => void;
  /** Refresh balance */
  refreshBalance: () => Promise<void>;
}

/**
 * Hook for sending SPL token transfers with optional memo support
 *
 * @param mint - The token mint address
 * @param decimals - The token decimals (e.g., 6 for USDC, 9 for SOL)
 *
 * @example
 * ```tsx
 * const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
 * const { balance, transfer, status } = useTokenTransfer(USDC_MINT, 6);
 *
 * const handleSend = async () => {
 *   const result = await transfer(recipientAddress, 10.50, "Payment");
 *   if (result.signature) {
 *     console.log("Transfer successful:", result.signature);
 *   }
 * };
 * ```
 */
export function useTokenTransfer(
  mint: string,
  decimals: number,
): UseTokenTransferReturn {
  const wallet = useWallet();
  const {
    balance: tokenBalance,
    helper: splHelper,
    refresh,
    isFetching,
    status: tokenStatus,
  } = useSplToken(mint);

  const transactionPool = useTransactionPool();

  const [status, setStatus] = useState<TransferStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);

  // Watch for signature confirmation
  const { confirmationStatus } = useWaitForSignature(
    currentSignature ?? undefined,
    {
      disabled: !currentSignature,
      commitment: "confirmed",
    },
  );

  // Update status when confirmation comes in
  useEffect(() => {
    if (
      currentSignature &&
      confirmationStatus === "confirmed" &&
      status === "confirming"
    ) {
      setStatus("success");
    }
  }, [currentSignature, confirmationStatus, status]);

  // Convert raw balance to UI amount
  const balance =
    tokenBalance?.exists && tokenBalance.amount !== undefined
      ? Number(tokenBalance.amount) / Math.pow(10, decimals)
      : null;

  const transfer = useCallback(
    async (
      recipient: string,
      amount: number,
      memo?: string,
    ): Promise<TransferResult> => {
      if (wallet.status !== "connected") {
        setError("Wallet not connected");
        setStatus("error");
        return { signature: null, error: "Wallet not connected" };
      }

      setError(null);
      setCurrentSignature(null);
      setStatus("preparing");

      try {
        const destinationAddress = address(recipient);
        const walletSession = wallet.session;
        const senderAddress = walletSession.account.address;

        // If no memo, use the simple send method
        if (!memo || memo.trim() === "") {
          setStatus("signing");

          const result = await splHelper.sendTransfer({
            amount: amount.toString(),
            destinationOwner: destinationAddress,
            authority: walletSession,
          });

          const signatureStr = String(result);
          setCurrentSignature(signatureStr);
          setStatus("confirming");

          return { signature: signatureStr, error: null };
        }

        // With memo, we need to build a custom transaction

        // Prepare the SPL transfer (this gives us the prepared transaction with instructions)
        const prepared = await splHelper.prepareTransfer({
          amount: amount.toString(),
          destinationOwner: destinationAddress,
          authority: walletSession,
        });

        // Clear any existing instructions
        transactionPool.clearInstructions();

        // Create memo instruction
        const memoInstruction = {
          programAddress: address(MEMO_PROGRAM_ID),
          accounts: [
            {
              address: senderAddress,
              role: 3 as const, // AccountRole.WRITABLE_SIGNER
            },
          ],
          data: new TextEncoder().encode(memo),
        };

        // Add memo instruction
        transactionPool.addInstruction(memoInstruction);

        // The prepared object has a message with instructions
        // We need to extract and add them to our pool
        if (
          prepared.message &&
          "instructions" in prepared.message &&
          Array.isArray(prepared.message.instructions)
        ) {
          for (const ix of prepared.message.instructions) {
            transactionPool.addInstruction(ix);
          }
        }

        setStatus("signing");

        const signature = await transactionPool.prepareAndSend({
          feePayer: senderAddress,
        });

        const signatureStr = String(signature);
        setCurrentSignature(signatureStr);
        setStatus("confirming");

        return { signature: signatureStr, error: null };
      } catch (err: unknown) {
        let errorMessage = "Transfer failed";

        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (typeof err === "string") {
          errorMessage = err;
        } else if (err && typeof err === "object") {
          const errObj = err as Record<string, unknown>;
          if (errObj.message) errorMessage = String(errObj.message);
        }

        setError(errorMessage);
        setStatus("error");
        return { signature: null, error: errorMessage };
      }
    },
    [wallet, splHelper, transactionPool],
  );

  const reset = useCallback(() => {
    transactionPool.reset();
    setStatus("idle");
    setError(null);
    setCurrentSignature(null);
  }, [transactionPool]);

  const refreshBalance = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Determine if transferring based on internal state
  const isTransferring =
    transactionPool.isPreparing ||
    transactionPool.isSending ||
    status === "preparing" ||
    status === "signing" ||
    status === "confirming";

  // Use pool error if we have one
  const displayError =
    error ||
    (transactionPool.sendError ? String(transactionPool.sendError) : null) ||
    (transactionPool.prepareError
      ? String(transactionPool.prepareError)
      : null);

  return {
    balance,
    isLoadingBalance: isFetching || tokenStatus === "loading",
    status,
    isTransferring,
    signature: currentSignature,
    error: displayError,
    transfer,
    reset,
    refreshBalance,
  };
}

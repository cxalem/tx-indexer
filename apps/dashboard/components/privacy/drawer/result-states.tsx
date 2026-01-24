"use client";

import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { truncate } from "@/lib/utils";
import type { OperationMode } from "./types";

interface SuccessStateProps {
  mode: OperationMode;
  amount: number;
  token: string;
  recipientAddress: string;
  signature: string;
  walletAddress: string | null;
  onClose: () => void;
}

export function SuccessState({
  mode,
  amount,
  token,
  recipientAddress,
  signature,
  walletAddress,
  onClose,
}: SuccessStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
        <CheckCircle2
          className="h-8 w-8 text-green-600 dark:text-green-400"
          aria-hidden="true"
        />
      </div>
      <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
        {mode === "deposit" ? "Shielded!" : "Sent!"}
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-4">
        {amount} {token}{" "}
        {mode === "deposit"
          ? "added to your private balance"
          : `sent to ${truncate(recipientAddress)}`}
      </p>
      <a
        href={`https://itx-indexer.com/indexer/${signature}?add=${walletAddress}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-vibrant-red hover:underline flex items-center gap-1 mb-6 cursor-pointer"
      >
        View transaction
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={onClose}
        className="px-6 py-2.5 rounded-lg bg-vibrant-red text-white text-sm font-medium hover:bg-vibrant-red/90 transition-colors cursor-pointer"
      >
        Done
      </button>
    </div>
  );
}

interface ErrorStateProps {
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

export function ErrorState({ error, onClose, onRetry }: ErrorStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <XCircle
          className="h-8 w-8 text-red-600 dark:text-red-400"
          aria-hidden="true"
        />
      </div>
      <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
        Operation failed
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-6">
        {error || "Something went wrong. Please try again."}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2.5 rounded-lg bg-vibrant-red text-white text-sm font-medium hover:bg-vibrant-red/90 transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

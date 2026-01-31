import { truncate } from "@/lib/utils";
import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import type { TransferStatus } from "@/hooks/use-usdc-transfer";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getStatusMessage(status: TransferStatus): string {
  switch (status) {
    case "preparing":
      return "Preparing transaction…";
    case "signing":
      return "Please sign in your wallet…";
    case "confirming":
      return "Confirming transaction…";
    case "success":
      return "Transfer complete!";
    case "error":
      return "Transfer failed";
    default:
      return "";
  }
}

interface TransferringOverlayProps {
  status: TransferStatus;
}

export function TransferringOverlay({ status }: TransferringOverlayProps) {
  return (
    <div className="absolute inset-0 bg-white/90 dark:bg-neutral-900/90 z-10 flex flex-col items-center justify-center">
      <Loader2
        className="h-8 w-8 animate-spin text-vibrant-red mb-4"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {getStatusMessage(status)}
      </p>
    </div>
  );
}

interface TransferSuccessProps {
  amount: number;
  recipientLabel: string | null;
  recipientAddress: string;
  signature: string;
  senderAddress: string | null;
  onClose: () => void;
  /** Token symbol to display (defaults to USDC) */
  tokenSymbol?: string;
}

export function TransferSuccess({
  amount,
  recipientLabel,
  recipientAddress,
  signature,
  senderAddress,
  onClose,
  tokenSymbol = "USDC",
}: TransferSuccessProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
        <CheckCircle2
          className="h-8 w-8 text-green-600 dark:text-green-400"
          aria-hidden="true"
        />
      </div>
      <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
        Transfer complete!
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-4">
        {formatUsd(amount)} {tokenSymbol} sent to{" "}
        {recipientLabel || truncate(recipientAddress)}
      </p>
      <a
        href={`https://itx-indexer.com/indexer/${signature}?add=${senderAddress}`}
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

interface TransferErrorProps {
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

export function TransferError({ error, onClose, onRetry }: TransferErrorProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <XCircle
          className="h-8 w-8 text-red-600 dark:text-red-400"
          aria-hidden="true"
        />
      </div>
      <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
        Transfer failed
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

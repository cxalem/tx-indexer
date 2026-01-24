"use client";

import { Loader2 } from "lucide-react";
import type { OperationMode } from "./types";

function getStatusMessage(status: string, mode: OperationMode): string {
  const messages: Record<string, string> = {
    initializing: "Please sign the message to initialize...",
    preparing: "Preparing transaction...",
    generating_proof: "Generating proof... This may take a moment.",
    signing: "Please sign the transaction in your wallet...",
    confirming: "Confirming on-chain...",
    success:
      mode === "deposit"
        ? "Deposited to private balance!"
        : "Withdrawn from private balance!",
    error: "Operation failed",
  };
  return messages[status] || "";
}

interface ProcessingOverlayProps {
  status: string;
  mode: OperationMode;
}

export function ProcessingOverlay({ status, mode }: ProcessingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-white/90 dark:bg-neutral-900/90 z-10 flex flex-col items-center justify-center">
      <Loader2
        className="h-8 w-8 animate-spin text-purple-500 mb-4"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {getStatusMessage(status, mode)}
      </p>
    </div>
  );
}

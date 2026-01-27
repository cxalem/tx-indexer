"use client";

import { DotLottiePlayer } from "@/components/ui/dot-lottie";
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
      <DotLottiePlayer
        src="/security-lock-privacy-purple.lottie"
        loop
        autoplay
        width={72}
        height={72}
        className="mb-4"
      />
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {getStatusMessage(status, mode)}
      </p>
    </div>
  );
}

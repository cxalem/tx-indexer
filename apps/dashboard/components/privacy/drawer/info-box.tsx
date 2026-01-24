"use client";

import { Shield } from "lucide-react";
import type { OperationMode } from "./types";

interface InfoBoxProps {
  mode: OperationMode;
}

export function InfoBox({ mode }: InfoBoxProps) {
  const message =
    mode === "deposit"
      ? "Your funds will be shielded using zero-knowledge proofs. Once deposited, your private balance can't be linked to your wallet."
      : "This transfer is private. The receiver won't be able to see your wallet address or trace the origin of the funds.";

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
      <Shield
        className="h-4 w-4 text-purple-500 shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <p className="text-xs text-purple-700 dark:text-purple-300">{message}</p>
    </div>
  );
}

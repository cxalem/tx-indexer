"use client";

import { Info } from "lucide-react";
import type { OperationMode } from "./types";

interface InfoBoxProps {
  mode: OperationMode;
}

export function InfoBox({ mode }: InfoBoxProps) {
  const message =
    mode === "deposit"
      ? "This will transfer funds from your wallet to your private balance. Processing may take a few seconds."
      : "A small fee is deducted to cover network costs. The relayer processes the withdrawal for you.";

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
      <Info
        className="h-4 w-4 text-neutral-500 shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        {message}
      </p>
    </div>
  );
}

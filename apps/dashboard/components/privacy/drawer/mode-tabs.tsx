"use client";

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperationMode } from "./types";

interface ModeTabsProps {
  mode: OperationMode;
  onModeChange: (mode: OperationMode) => void;
}

export function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  return (
    <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1">
      <button
        type="button"
        onClick={() => onModeChange("deposit")}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
          mode === "deposit"
            ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100",
        )}
      >
        <ArrowDownToLine className="h-4 w-4" />
        Deposit
      </button>
      <button
        type="button"
        onClick={() => onModeChange("withdraw")}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
          mode === "withdraw"
            ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100",
        )}
      >
        <ArrowUpFromLine className="h-4 w-4" />
        Withdraw
      </button>
    </div>
  );
}

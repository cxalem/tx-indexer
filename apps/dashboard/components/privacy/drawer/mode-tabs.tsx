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
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onModeChange("deposit")}
        className={cn(
          "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer",
          mode === "deposit"
            ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800",
        )}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        Deposit
      </button>
      <button
        type="button"
        onClick={() => onModeChange("withdraw")}
        className={cn(
          "flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer",
          mode === "withdraw"
            ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800",
        )}
      >
        <ArrowUpFromLine className="h-3.5 w-3.5" />
        Send
      </button>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import type { HubTab } from "./types";

interface HubTabsProps {
  activeTab: HubTab;
  onTabChange: (tab: HubTab) => void;
}

export function HubTabs({ activeTab, onTabChange }: HubTabsProps) {
  return (
    <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1">
      <button
        type="button"
        onClick={() => onTabChange("transfer")}
        className={cn(
          "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
          activeTab === "transfer"
            ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100",
        )}
      >
        Transfer
      </button>
      <button
        type="button"
        onClick={() => onTabChange("swap")}
        className={cn(
          "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
          activeTab === "swap"
            ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100",
        )}
      >
        Swap
      </button>
    </div>
  );
}

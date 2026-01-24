"use client";

import { truncate } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";

interface LabeledAddressProps {
  address: string;
  label?: string | null;
  isYou?: boolean;
}

/**
 * Displays a wallet address with an optional label.
 * If isYou is true, shows a "You" badge with the truncated address.
 * If a label exists, shows the label prominently with the truncated address below it.
 * Always includes a copy button for the full address.
 */
export function LabeledAddress({ address, label, isYou }: LabeledAddressProps) {
  if (isYou) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-vibrant-red/10 text-vibrant-red">
          You
        </span>
        <span className="font-mono text-sm text-neutral-500 dark:text-neutral-400">
          {truncate(address)}
        </span>
        <CopyButton value={address} />
      </div>
    );
  }

  if (label) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {label}
          </span>
          <CopyButton value={address} />
        </div>
        <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
          {truncate(address)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
        {truncate(address)}
      </span>
      <CopyButton value={address} />
    </div>
  );
}

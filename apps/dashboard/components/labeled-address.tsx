"use client";

import { truncate } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";

interface LabeledAddressProps {
  address: string;
  label?: string | null;
}

/**
 * Displays a wallet address with an optional label.
 * If a label exists, shows the label prominently with the truncated address below it.
 * Always includes a copy button for the full address.
 */
export function LabeledAddress({ address, label }: LabeledAddressProps) {
  if (label) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-neutral-900">{label}</span>
          <CopyButton value={address} />
        </div>
        <span className="font-mono text-xs text-neutral-400">
          {truncate(address)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-sm">{truncate(address)}</span>
      <CopyButton value={address} />
    </div>
  );
}

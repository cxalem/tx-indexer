import { Loader2 } from "lucide-react";
import type { FeeEstimate } from "@/app/actions/estimate-fee";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface TransferSummaryProps {
  amountUsd: number;
  feeEstimate: FeeEstimate | null;
  isFeeLoading: boolean;
}

export function TransferSummary({
  amountUsd,
  feeEstimate,
  isFeeLoading,
}: TransferSummaryProps) {
  const feeUsd = feeEstimate?.feeUsd ?? 0;
  const totalUsd = amountUsd + feeUsd;

  return (
    <div className="mt-6 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
      <p className="text-xs text-neutral-500 mb-3">summary</p>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">amount</span>
          <span className="font-mono">{formatUsd(amountUsd)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-600">
            fee
            {feeEstimate?.needsAccountCreation && (
              <span className="text-neutral-400 text-xs ml-1">
                (includes account setup)
              </span>
            )}
          </span>
          <span className="text-neutral-500 flex items-center gap-1">
            {isFeeLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : feeUsd < 0.01 ? (
              "less than $0.01"
            ) : (
              <span className="font-mono">{formatUsd(feeUsd)}</span>
            )}
          </span>
        </div>
        <div className="border-t border-neutral-200 pt-2 mt-2">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-neutral-900">total</span>
            <span className="font-mono text-neutral-900">
              {formatUsd(totalUsd)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

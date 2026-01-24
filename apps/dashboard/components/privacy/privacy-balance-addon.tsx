"use client";

import { Shield, RefreshCw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PrivacyCashStatus } from "@/hooks/use-privacy-cash";
import type { PrivacyBalance } from "@/lib/privacy/privacy-cash-client";

export interface PrivacyBalanceAddonProps {
  privateBalance: PrivacyBalance | null;
  isLoading: boolean;
  status: PrivacyCashStatus;
  error: string | null;
  onRefresh?: () => void;
  className?: string;
}

export function PrivacyBalanceAddon({
  privateBalance,
  isLoading,
  status,
  error,
  onRefresh,
  className,
}: PrivacyBalanceAddonProps) {
  const hasBalance = privateBalance && privateBalance.amount > 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg",
        "bg-gradient-to-r from-purple-500/10 to-indigo-500/10",
        "border border-purple-500/20",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-purple-400" />
        <span className="text-sm text-muted-foreground">Private Balance</span>
      </div>

      <div className="flex items-center gap-2">
        {error ? (
          <div className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Error</span>
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-1">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {hasBalance
                ? `${privateBalance.amount.toFixed(4)} ${privateBalance.token}`
                : "0.00"}
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1 hover:bg-purple-500/20 rounded transition-colors"
                aria-label="Refresh private balance"
              >
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PrivacyBalanceSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg",
        "bg-gradient-to-r from-purple-500/5 to-indigo-500/5",
        "border border-purple-500/10 animate-pulse",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-purple-500/20" />
        <div className="h-4 w-24 rounded bg-muted" />
      </div>
      <div className="h-4 w-16 rounded bg-muted" />
    </div>
  );
}

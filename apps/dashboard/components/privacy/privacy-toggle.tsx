"use client";

import { Shield, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PrivacyToggleProps {
  enabled: boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  compact?: boolean;
  className?: string;
}

export function PrivacyToggle({
  enabled,
  loading,
  disabled,
  onToggle,
  compact,
  className,
}: PrivacyToggleProps) {
  const isDisabled = loading || disabled;

  if (compact) {
    return (
      <button
        onClick={onToggle}
        disabled={isDisabled}
        className={cn(
          "flex items-center justify-center p-2 rounded-lg transition-colors",
          enabled
            ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
          isDisabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        aria-label={
          enabled ? "Disable privacy features" : "Enable privacy features"
        }
        title={
          enabled ? "Privacy features enabled" : "Privacy features disabled"
        }
      >
        {enabled ? (
          <Shield className="h-4 w-4" />
        ) : (
          <ShieldOff className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg",
        "bg-card border",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "p-2 rounded-lg",
            enabled ? "bg-purple-500/20" : "bg-muted",
          )}
        >
          {enabled ? (
            <Shield className="h-5 w-5 text-purple-400" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div>
          <label
            htmlFor="privacy-toggle"
            className="font-medium cursor-pointer block"
          >
            Privacy Features
          </label>
          <p className="text-sm text-muted-foreground">
            {enabled
              ? "Shielded balances and private transfers enabled"
              : "Enable to access Privacy Cash features"}
          </p>
        </div>
      </div>

      <button
        id="privacy-toggle"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        disabled={isDisabled}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer",
          enabled ? "bg-purple-500" : "bg-neutral-200 dark:bg-neutral-700",
          isDisabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full transition-transform shadow-sm",
            enabled
              ? "translate-x-6 bg-white"
              : "translate-x-1 bg-white dark:bg-neutral-300",
          )}
        />
      </button>
    </div>
  );
}

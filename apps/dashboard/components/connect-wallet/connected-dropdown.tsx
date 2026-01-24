"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { truncate, cn } from "@/lib/utils";

interface ConnectedDropdownProps {
  address: string | null;
  isAuthenticated: boolean;
  isSessionExpired: boolean;
  isReAuthenticating: boolean;
  hasSignMessageSupport: boolean;
  isDesktopConnected: boolean;
  onReAuthenticate: () => void;
  onDisconnect: () => void;
}

export function ConnectedDropdown({
  address,
  isAuthenticated,
  isSessionExpired,
  isReAuthenticating,
  hasSignMessageSupport,
  isDesktopConnected,
  onReAuthenticate,
  onDisconnect,
}: ConnectedDropdownProps) {
  return (
    <div className="p-2 space-y-2">
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {isSessionExpired ? "wallet connected" : "signed in"}
          </p>
          {isAuthenticated ? (
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
              active
            </span>
          ) : (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded flex items-center gap-1">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              session expired
            </span>
          )}
        </div>
        <p className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
          {truncate(address ?? "")}
        </p>
      </div>

      {isSessionExpired && (
        <button
          type="button"
          onClick={onReAuthenticate}
          disabled={
            isReAuthenticating || (isDesktopConnected && !hasSignMessageSupport)
          }
          className={cn(
            "w-full px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer",
            "bg-vibrant-red text-white hover:bg-vibrant-red/90",
            (isReAuthenticating ||
              (isDesktopConnected && !hasSignMessageSupport)) &&
              "opacity-70 cursor-not-allowed",
          )}
        >
          {isReAuthenticating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              signing in…
            </>
          ) : isDesktopConnected && !hasSignMessageSupport ? (
            "wallet doesn't support signing"
          ) : (
            "sign in again"
          )}
        </button>
      )}

      <button
        type="button"
        role="menuitem"
        onClick={onDisconnect}
        className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer text-neutral-900 dark:text-neutral-100"
      >
        sign out
      </button>
    </div>
  );
}

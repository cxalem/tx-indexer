"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TokenIcon } from "@/components/token-icon";
import {
  PRIVACY_CASH_SUPPORTED_TOKENS,
  PRIVACY_CASH_TOKEN_LIST,
  type PrivacyCashToken,
} from "@/lib/privacy/constants";
import { TOKEN_LOGOS, type AssetSelectorProps } from "./types";

export function AssetSelector({
  selectedToken,
  walletBalance,
  privateBalance,
  mode,
  dashboardBalance,
  privateBalances,
  isLoadingPrivateBalances = false,
  onTokenSelect,
}: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div>
      <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
        asset
      </label>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm transition-colors hover:border-neutral-300 dark:hover:border-neutral-600"
        >
          <div className="flex items-center gap-3">
            <TokenIcon
              symbol={selectedToken}
              logoURI={TOKEN_LOGOS[selectedToken]}
              size="md"
            />
            <div className="text-left">
              <p className="font-medium text-neutral-900 dark:text-neutral-100">
                {selectedToken}
              </p>
              <p className="text-xs text-neutral-500">
                {mode === "deposit"
                  ? `Balance: ${walletBalance.toFixed(4)}`
                  : `Private: ${privateBalance.toFixed(4)}`}
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-neutral-500 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </button>

        <div
          className={cn(
            "absolute top-full left-0 right-0 mt-1 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-10 transition-all duration-200 origin-top",
            isOpen
              ? "opacity-100 scale-y-100 translate-y-0"
              : "opacity-0 scale-y-95 -translate-y-1 pointer-events-none",
          )}
        >
          {PRIVACY_CASH_TOKEN_LIST.map((token) => {
            const tokenConf = PRIVACY_CASH_SUPPORTED_TOKENS[token];
            const tokenWalletBal =
              token === "SOL"
                ? (dashboardBalance?.sol.ui ?? 0)
                : (dashboardBalance?.tokens.find(
                    (t) => t.mint === tokenConf.mint,
                  )?.amount.ui ?? 0);
            const tokenPrivateBal = privateBalances[token] ?? 0;

            // Show wallet balance for deposit, private balance for withdraw
            const displayBalance =
              mode === "deposit" ? tokenWalletBal : tokenPrivateBal;
            const balanceLabel = mode === "deposit" ? "Balance" : "Private";
            const showLoading = mode === "withdraw" && isLoadingPrivateBalances;

            return (
              <button
                key={token}
                type="button"
                onClick={() => {
                  onTokenSelect(token);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors",
                  selectedToken === token &&
                    "bg-purple-50 dark:bg-purple-900/20",
                )}
              >
                <TokenIcon
                  symbol={token}
                  logoURI={TOKEN_LOGOS[token]}
                  size="md"
                />
                <div className="flex-1 text-left">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {token}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {showLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin inline" />
                    ) : (
                      <>
                        {balanceLabel}: {displayBalance.toFixed(4)}
                      </>
                    )}
                  </p>
                </div>
                {selectedToken === token && (
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

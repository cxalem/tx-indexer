"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowDown, ChevronDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TokenIcon } from "@/components/token-icon";
import { type PrivacyCashToken } from "@/lib/privacy/constants";
import { TOKEN_LOGOS } from "./types";

// SOL -> SPL only for now
const ALLOWED_OUTPUT_TOKENS: PrivacyCashToken[] = ["USDC", "USDT"];

interface SwapContentProps {
  fromToken: PrivacyCashToken;
  toToken: PrivacyCashToken;
  amount: string;
  estimatedOutput: string;
  privateBalances: Record<PrivacyCashToken, number>;
  isLoadingQuote: boolean;
  isBelowMinimum?: boolean;
  minimumAmount?: number;
  onFromTokenChange: (token: PrivacyCashToken) => void;
  onToTokenChange: (token: PrivacyCashToken) => void;
  onAmountChange: (amount: string) => void;
  onSwapDirection: () => void;
}

// Static token display (non-interactive)
function TokenDisplay({ token }: { token: PrivacyCashToken }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
      <TokenIcon symbol={token} logoURI={TOKEN_LOGOS[token]} size="sm" />
      <span className="font-medium text-neutral-900 dark:text-neutral-100">
        {token}
      </span>
    </div>
  );
}

function TokenDropdown({
  selectedToken,
  onSelect,
  allowedTokens,
}: {
  selectedToken: PrivacyCashToken;
  onSelect: (token: PrivacyCashToken) => void;
  allowedTokens: PrivacyCashToken[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
      >
        <TokenIcon
          symbol={selectedToken}
          logoURI={TOKEN_LOGOS[selectedToken]}
          size="sm"
        />
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          {selectedToken}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-neutral-500 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "absolute top-full left-0 mt-1 py-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-20 min-w-[140px] transition-all duration-200 origin-top",
          isOpen
            ? "opacity-100 scale-y-100"
            : "opacity-0 scale-y-95 pointer-events-none",
        )}
      >
        {allowedTokens.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => {
              onSelect(token);
              setIsOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors",
              selectedToken === token && "bg-purple-50 dark:bg-purple-900/20",
            )}
          >
            <TokenIcon symbol={token} logoURI={TOKEN_LOGOS[token]} size="sm" />
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {token}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SwapContent({
  fromToken,
  toToken,
  amount,
  estimatedOutput,
  privateBalances,
  isLoadingQuote,
  isBelowMinimum = false,
  minimumAmount = 0.01,
  onFromTokenChange,
  onToTokenChange,
  onAmountChange,
  onSwapDirection,
}: SwapContentProps) {
  const fromBalance = privateBalances[fromToken] ?? 0;
  const amountNum = parseFloat(amount) || 0;
  const insufficientBalance = amountNum > fromBalance;
  const hasNoBalance = fromBalance === 0;

  return (
    <div className="space-y-3">
      {/* From section */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            From
          </span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs",
                insufficientBalance
                  ? "text-red-500"
                  : "text-neutral-500 dark:text-neutral-400",
              )}
            >
              Private: {fromBalance.toFixed(4)}
            </span>
            <button
              type="button"
              onClick={() => onAmountChange(String(fromBalance))}
              className="text-xs font-medium text-purple-500 hover:text-purple-400 transition-colors"
            >
              max
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                  onAmountChange(val);
                }
              }}
              placeholder="0.00"
              disabled={hasNoBalance}
              className={cn(
                "flex-1 min-w-0 text-2xl font-mono bg-transparent outline-none text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
                insufficientBalance && "text-red-500",
                isBelowMinimum && !insufficientBalance && "text-purple-500",
                hasNoBalance && "cursor-not-allowed opacity-50",
              )}
            />
            {isBelowMinimum && !insufficientBalance && amountNum > 0 && (
              <div className="relative group">
                <AlertCircle className="h-4 w-4 text-purple-500 cursor-help" />
                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-neutral-900 dark:bg-neutral-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-30">
                  Amount too low. Minimum is {minimumAmount} SOL to cover fees.
                  <div className="absolute bottom-0 right-3 translate-y-1/2 rotate-45 w-2 h-2 bg-neutral-900 dark:bg-neutral-800" />
                </div>
              </div>
            )}
          </div>
          {/* SOL is locked as "from" token - display only */}
          <TokenDisplay token="SOL" />
        </div>
        {insufficientBalance && (
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Not enough in private balance
          </p>
        )}
      </div>

      {/* Direction indicator (one-way only: SOL -> SPL) */}
      <div className="flex justify-center -my-1 relative z-10">
        <div className="p-2 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
          <ArrowDown className="h-4 w-4 text-neutral-400" />
        </div>
      </div>

      {/* To section */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            To
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-2xl font-mono text-neutral-700 dark:text-neutral-300">
            {isLoadingQuote ? (
              <span className="text-neutral-400 animate-pulse">...</span>
            ) : estimatedOutput ? (
              `≈ ${estimatedOutput}`
            ) : (
              <span className="text-neutral-400 dark:text-neutral-500">
                0.00
              </span>
            )}
          </div>
          <TokenDropdown
            selectedToken={toToken}
            onSelect={onToTokenChange}
            allowedTokens={ALLOWED_OUTPUT_TOKENS}
          />
        </div>
      </div>

      {/* Fee disclaimer */}
      <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
        Private swaps have higher fees than regular swaps
      </p>

      {/* No balance message */}
      {hasNoBalance && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-500 shrink-0 mt-0.5" />
          <p className="text-xs text-purple-700 dark:text-purple-400">
            Deposit funds first to swap privately
          </p>
        </div>
      )}
    </div>
  );
}

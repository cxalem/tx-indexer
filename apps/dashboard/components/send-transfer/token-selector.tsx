"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { TokenIcon } from "@/components/token-icon";
import { cn } from "@/lib/utils";

export interface SendableToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance: number;
  /** USD price per token (null if unknown) */
  price: number | null;
}

interface TokenSelectorProps {
  tokens: SendableToken[];
  selectedToken: SendableToken;
  onSelectToken: (token: SendableToken) => void;
  disabled?: boolean;
}

function formatBalance(balance: number, decimals: number) {
  if (balance === 0) return "0";
  if (balance < 0.01) return balance.toFixed(Math.min(decimals, 6));
  return balance.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Inline token selector with Framer Motion animations
 * Custom implementation to avoid Radix Select's scroll lock behavior
 * which causes layout shift
 */
export function TokenSelector({
  tokens,
  selectedToken,
  onSelectToken,
  disabled = false,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleSelect = useCallback(
    (token: SendableToken) => {
      onSelectToken(token);
      setIsOpen(false);
    },
    [onSelectToken],
  );

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (disabled) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (event.key === "ArrowDown" && !isOpen) {
        event.preventDefault();
        setIsOpen(true);
      }
    },
    [disabled, isOpen],
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select token"
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-full",
          "bg-neutral-100 dark:bg-neutral-700/50 hover:bg-neutral-200 dark:hover:bg-neutral-700",
          "text-sm font-medium text-neutral-900 dark:text-neutral-100",
          "transition-colors cursor-pointer",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-vibrant-red focus-visible:ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <TokenIcon
          symbol={selectedToken.symbol}
          logoURI={selectedToken.logoURI}
          size="xs"
        />
        <span>{selectedToken.symbol}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="listbox"
            aria-label="Token options"
            className={cn(
              "absolute right-0 top-full mt-1 z-50 min-w-[220px] overflow-hidden rounded-lg",
              "border border-neutral-200 dark:border-neutral-700",
              "bg-white dark:bg-neutral-800 shadow-lg",
            )}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 0.8,
            }}
          >
            <div className="p-1 max-h-[300px] overflow-y-auto">
              {tokens.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  no tokens available
                </div>
              ) : (
                tokens.map((token, index) => {
                  const isSelected = token.mint === selectedToken.mint;
                  return (
                    <motion.button
                      key={token.mint}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(token)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer",
                        "text-sm text-neutral-900 dark:text-neutral-100",
                        "outline-none select-none transition-colors",
                        "hover:bg-neutral-100 dark:hover:bg-neutral-700/50",
                        "focus:bg-neutral-100 dark:focus:bg-neutral-700/50",
                        isSelected && "bg-vibrant-red/10",
                      )}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: index * 0.03,
                        duration: 0.15,
                      }}
                    >
                      <TokenIcon
                        symbol={token.symbol}
                        logoURI={token.logoURI}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "font-medium truncate",
                              isSelected && "text-vibrant-red",
                            )}
                          >
                            {token.symbol}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-mono",
                              isSelected
                                ? "text-vibrant-red/70"
                                : "text-neutral-500 dark:text-neutral-400",
                            )}
                          >
                            {formatBalance(token.balance, token.decimals)}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "text-xs truncate",
                            isSelected
                              ? "text-vibrant-red/60"
                              : "text-neutral-400 dark:text-neutral-500",
                          )}
                        >
                          {token.name}
                        </p>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

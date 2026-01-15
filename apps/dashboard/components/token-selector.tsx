"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SwapToken } from "@/lib/swap-tokens";

interface TokenSelectorProps {
  selectedToken: SwapToken;
  tokens: SwapToken[];
  onSelect: (token: SwapToken) => void;
  disabled?: boolean;
}

export function TokenSelector({
  selectedToken,
  tokens,
  onSelect,
  disabled,
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 bg-white",
          "hover:bg-neutral-50 transition-colors min-w-[120px] cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {selectedToken.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- External token logos from arbitrary CDNs
          <img
            src={selectedToken.logoUrl}
            alt={selectedToken.symbol}
            width={20}
            height={20}
            className="w-5 h-5 rounded-full object-cover flex-shrink-0"
          />
        )}
        <span className="font-medium">{selectedToken.symbol}</span>
        <ChevronDown className="h-4 w-4 text-neutral-400 ml-auto flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full min-w-[160px] rounded-lg border border-neutral-200 bg-white shadow-lg py-1">
          {tokens.map((token) => (
            <button
              key={token.mint}
              type="button"
              onClick={() => {
                onSelect(token);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors cursor-pointer",
                token.mint === selectedToken.mint && "bg-neutral-50",
              )}
            >
              {token.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- External token logos from arbitrary CDNs
                <img
                  src={token.logoUrl}
                  alt={token.symbol}
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                />
              )}
              <div>
                <p className="font-medium">{token.symbol}</p>
                <p className="text-xs text-neutral-500">{token.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

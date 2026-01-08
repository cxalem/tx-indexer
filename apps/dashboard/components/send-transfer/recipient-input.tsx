"use client";

import { useRef, useEffect } from "react";
import { cn, truncate } from "@/lib/utils";
import { Tag, AlertCircle, LogIn } from "lucide-react";
import type { WalletLabel } from "@/app/actions/wallet-labels";

interface RecipientInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: string | null;
  currentLabel: string | null;
  savedLabels: WalletLabel[];
  showAutocomplete: boolean;
  onShowAutocomplete: (show: boolean) => void;
  onSelectLabel: (label: WalletLabel) => void;
  needsReauth: boolean;
  showSignInPrompt: boolean;
  onShowSignInPrompt: () => void;
}

export function RecipientInput({
  value,
  onChange,
  onBlur,
  error,
  currentLabel,
  savedLabels,
  showAutocomplete,
  onShowAutocomplete,
  onSelectLabel,
  needsReauth,
  showSignInPrompt,
  onShowSignInPrompt,
}: RecipientInputProps) {
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        onShowAutocomplete(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onShowAutocomplete]);

  const filteredLabels = savedLabels.filter(
    (l) =>
      l.label.toLowerCase().includes(value.toLowerCase()) ||
      l.address.toLowerCase().includes(value.toLowerCase()),
  );

  return (
    <div className="relative" ref={autocompleteRef}>
      <label className="text-xs text-neutral-500 mb-1 block">to</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (e.target.value && savedLabels.length > 0) {
              onShowAutocomplete(true);
            }
          }}
          onFocus={() => {
            if (value && savedLabels.length > 0) {
              onShowAutocomplete(true);
            }
          }}
          onBlur={onBlur}
          placeholder={
            savedLabels.length > 0
              ? "Enter address or search saved contacts"
              : "Enter recipient address"
          }
          className={cn(
            "w-full px-3 py-2.5 rounded-lg border bg-white font-mono text-sm transition-colors",
            "focus:outline-none focus:border-vibrant-red",
            error ? "border-red-400" : "border-neutral-200",
          )}
        />
        {currentLabel && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">
            <Tag className="h-3 w-3" />
            {currentLabel}
          </div>
        )}
      </div>

      {showAutocomplete && filteredLabels.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredLabels.map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => onSelectLabel(label)}
              className="w-full px-3 py-2 text-left hover:bg-neutral-50 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">{label.label}</p>
                <p className="text-xs text-neutral-500 font-mono">
                  {truncate(label.address)}
                </p>
              </div>
              <Tag className="h-3 w-3 text-neutral-400" />
            </button>
          ))}
        </div>
      )}

      <div className="h-5 mt-1">
        {error ? (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        ) : needsReauth && !showSignInPrompt ? (
          <button
            type="button"
            onClick={onShowSignInPrompt}
            className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            <LogIn className="h-3 w-3" />
            sign in to use saved contacts
          </button>
        ) : null}
      </div>
    </div>
  );
}

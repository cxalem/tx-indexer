"use client";

import { useRef, useEffect, useMemo } from "react";
import { cn, truncate } from "@/lib/utils";
import { Tag, AlertCircle, LogIn, X } from "lucide-react";
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
  onClear: () => void;
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
  onClear,
  needsReauth,
  showSignInPrompt,
  onShowSignInPrompt,
}: RecipientInputProps) {
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Ref for callback to avoid effect re-subscriptions
  const onShowAutocompleteRef = useRef(onShowAutocomplete);
  useEffect(() => {
    onShowAutocompleteRef.current = onShowAutocomplete;
  }, [onShowAutocomplete]);

  // Click outside handler - only subscribes once
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        onShowAutocompleteRef.current(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Memoize filtered labels to avoid recalculating on every render
  const filteredLabels = useMemo(
    () =>
      savedLabels.filter(
        (l) =>
          l.label.toLowerCase().includes(value.toLowerCase()) ||
          l.address.toLowerCase().includes(value.toLowerCase()),
      ),
    [savedLabels, value],
  );

  return (
    <div className="relative" ref={autocompleteRef}>
      <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
        to
      </label>
      <div className="relative">
        {currentLabel ? (
          // Show labeled wallet pill when a contact is selected
          <div
            className={cn(
              "w-full px-3 py-2.5 pr-10 rounded-lg border bg-white dark:bg-neutral-800 text-sm transition-colors",
              "border-neutral-200 dark:border-neutral-700",
              "flex items-center gap-2",
            )}
          >
            <Tag className="h-4 w-4 text-vibrant-red" />
            <span className="text-neutral-900 dark:text-neutral-100 font-medium">
              {currentLabel}
            </span>
            <span className="text-neutral-400 text-xs font-mono">
              ({truncate(value)})
            </span>
          </div>
        ) : (
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
              if (savedLabels.length > 0) {
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
              "w-full px-3 py-2.5 pr-10 rounded-lg border bg-white dark:bg-neutral-800 font-mono text-sm text-neutral-900 dark:text-neutral-100 transition-colors",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-vibrant-red focus-visible:border-vibrant-red",
              error
                ? "border-red-400 dark:border-red-700"
                : "border-neutral-200 dark:border-neutral-700",
            )}
          />
        )}
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="h-4 w-4 text-neutral-400" />
          </button>
        )}
      </div>

      {showAutocomplete && filteredLabels.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredLabels.map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => onSelectLabel(label)}
              className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between cursor-pointer"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {label.label}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                  {truncate(label.address)}
                </p>
              </div>
              <Tag className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
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
            className="text-xs text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer"
          >
            <LogIn className="h-3 w-3" />
            sign in to use saved contacts
          </button>
        ) : null}
      </div>
    </div>
  );
}

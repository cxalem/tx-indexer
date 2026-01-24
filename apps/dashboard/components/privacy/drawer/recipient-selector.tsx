"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Tag, Wallet, X } from "lucide-react";
import { cn, truncate } from "@/lib/utils";
import type { RecipientSelectorProps } from "./types";

export function RecipientSelector({
  recipientAddress,
  walletAddress,
  labelsList,
  onRecipientChange,
}: RecipientSelectorProps) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const isMyWalletSelected = recipientAddress === walletAddress;

  const selectedLabel = useMemo(() => {
    if (!recipientAddress || isMyWalletSelected) return null;
    return labelsList.find((l) => l.address === recipientAddress) || null;
  }, [recipientAddress, isMyWalletSelected, labelsList]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredContacts = useMemo(() => {
    if (!debouncedSearchQuery) return labelsList;
    const query = debouncedSearchQuery.toLowerCase();
    return labelsList.filter(
      (l) =>
        l.label.toLowerCase().includes(query) ||
        l.address.toLowerCase().includes(query),
    );
  }, [labelsList, debouncedSearchQuery]);

  return (
    <div ref={autocompleteRef}>
      <label className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block">
        recipient address
      </label>

      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => {
            if (isMyWalletSelected) {
              onRecipientChange("");
            } else if (walletAddress) {
              onRecipientChange(walletAddress);
              setShowAutocomplete(false);
            }
          }}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            isMyWalletSelected
              ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 border-transparent",
          )}
        >
          <Wallet className="h-3 w-3" />
          my wallet
        </button>
        {labelsList.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAutocomplete(!showAutocomplete)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors border border-transparent"
          >
            <Tag className="h-3 w-3" />
            contacts
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                showAutocomplete && "rotate-180",
              )}
            />
          </button>
        )}
      </div>

      <div className="relative">
        {isMyWalletSelected ? (
          <div
            className={cn(
              "w-full px-3 py-2.5 pr-10 rounded-lg border bg-white dark:bg-neutral-800 text-sm transition-colors",
              "border-neutral-200 dark:border-neutral-700",
              "flex items-center gap-2",
            )}
          >
            <Wallet className="h-4 w-4 text-purple-500" />
            <span className="text-neutral-900 dark:text-neutral-100 font-medium">
              my wallet
            </span>
            <span className="text-neutral-400 text-xs font-mono">
              ({truncate(walletAddress || "")})
            </span>
          </div>
        ) : selectedLabel ? (
          <div
            className={cn(
              "w-full px-3 py-2.5 pr-10 rounded-lg border bg-white dark:bg-neutral-800 text-sm transition-colors",
              "border-neutral-200 dark:border-neutral-700",
              "flex items-center gap-2",
            )}
          >
            <Tag className="h-4 w-4 text-purple-500" />
            <span className="text-neutral-900 dark:text-neutral-100 font-medium">
              {selectedLabel.label}
            </span>
            <span className="text-neutral-400 text-xs font-mono">
              ({truncate(selectedLabel.address)})
            </span>
          </div>
        ) : (
          <input
            type="text"
            value={recipientAddress}
            onChange={(e) => {
              onRecipientChange(e.target.value);
              setSearchQuery(e.target.value);
              if (e.target.value && labelsList.length > 0) {
                setShowAutocomplete(true);
              }
            }}
            onFocus={() => {
              if (labelsList.length > 0) {
                setShowAutocomplete(true);
              }
            }}
            placeholder={
              labelsList.length > 0
                ? "Enter address or search contacts"
                : "Enter Solana address"
            }
            className={cn(
              "w-full px-3 py-2.5 pr-10 rounded-lg border bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 transition-colors font-mono",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 focus-visible:border-purple-500",
              "border-neutral-200 dark:border-neutral-700",
            )}
          />
        )}
        {recipientAddress && (
          <button
            type="button"
            onClick={() => {
              onRecipientChange("");
              setSearchQuery("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X className="h-4 w-4 text-neutral-400" />
          </button>
        )}

        <AnimatePresence>
          {showAutocomplete &&
            filteredContacts.length > 0 &&
            !isMyWalletSelected && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                {filteredContacts.map((label, index) => (
                  <motion.button
                    key={label.id}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.15,
                      delay: index * 0.03,
                      ease: "easeOut",
                    }}
                    onClick={() => {
                      onRecipientChange(label.address);
                      setSearchQuery("");
                      setShowAutocomplete(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between"
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
                  </motion.button>
                ))}
              </motion.div>
            )}
        </AnimatePresence>
      </div>

      <p className="text-xs text-neutral-500 mt-1">
        The withdrawal cannot be linked to your deposit.
      </p>
    </div>
  );
}

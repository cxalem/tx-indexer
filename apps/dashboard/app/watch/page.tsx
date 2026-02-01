"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, ArrowRight, X, Wallet } from "lucide-react";
import { useRecentWatches } from "@/hooks/use-recent-watches";
import { truncate, cn } from "@/lib/utils";
import { bitcountFont } from "@/lib/fonts";
import { NoisyBackground } from "@/components/noisy-bg";
import { GridBackground } from "@/components/grid-bg";

function isValidSolanaAddress(address: string): boolean {
  // Basic validation: base58 characters, 32-44 chars long
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

export default function WatchLandingPage() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { recentWatches, isLoaded, addRecentWatch, removeRecentWatch } =
    useRecentWatches();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = address.trim();
      if (!trimmed) {
        setError("Please enter a wallet address");
        return;
      }

      if (!isValidSolanaAddress(trimmed)) {
        setError("Invalid Solana address");
        return;
      }

      // Add to recent watches and navigate
      addRecentWatch(trimmed);
      router.push(`/watch/${trimmed}`);
    },
    [address, addRecentWatch, router],
  );

  const handleRecentClick = useCallback(
    (watchAddress: string) => {
      addRecentWatch(watchAddress); // Move to top
      router.push(`/watch/${watchAddress}`);
    },
    [addRecentWatch, router],
  );

  return (
    <>
      {/* Background patterns */}
      <NoisyBackground showDots />
      <GridBackground />

      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <h1
              className={`${bitcountFont.className} text-xl text-neutral-900 dark:text-neutral-100`}
            >
              <span className="text-vibrant-red">{"//"}</span> watch
            </h1>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex items-start justify-center pt-16 sm:pt-24 px-4">
          <div className="w-full max-w-md space-y-8">
            {/* Hero */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-vibrant-red/10 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-6 h-6 text-vibrant-red" />
              </div>
              <h2 className="text-2xl font-medium text-neutral-900 dark:text-neutral-100">
                Watch any wallet
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400">
                Track activity and assets without connecting
              </p>
            </div>

            {/* Input form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="wallet-address"
                  className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 block"
                >
                  wallet address
                </label>
                <input
                  id="wallet-address"
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setError(null);
                  }}
                  placeholder="Paste Solana wallet address..."
                  className={cn(
                    "w-full px-4 py-3 rounded-lg border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-mono text-sm transition-colors",
                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-vibrant-red focus-visible:border-vibrant-red",
                    "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
                    error
                      ? "border-red-400 dark:border-red-700"
                      : "border-neutral-200 dark:border-neutral-700",
                  )}
                />
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-vibrant-red text-white font-medium hover:bg-vibrant-red/90 transition-colors cursor-pointer"
              >
                Watch wallet
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Recent watches */}
            <AnimatePresence mode="wait">
              {isLoaded && recentWatches.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    recent
                  </p>
                  <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 overflow-hidden">
                    <AnimatePresence initial={false}>
                      {recentWatches.map((watch, index) => (
                        <motion.div
                          key={watch.address}
                          initial={{ opacity: 0, x: -20, height: 0 }}
                          animate={{ opacity: 1, x: 0, height: "auto" }}
                          exit={{ opacity: 0, x: 20, height: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                            delay: index * 0.05,
                          }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 group",
                            index > 0 &&
                              "border-t border-neutral-100 dark:border-neutral-700",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleRecentClick(watch.address)}
                            className="flex-1 text-left font-mono text-sm text-neutral-700 dark:text-neutral-300 hover:text-vibrant-red transition-colors cursor-pointer"
                          >
                            {truncate(watch.address)}
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleRecentClick(watch.address)}
                              className="p-1.5 text-neutral-400 hover:text-vibrant-red transition-colors cursor-pointer"
                              aria-label="View wallet"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRecentWatch(watch.address)}
                              className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                              aria-label="Remove from recent"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Connect wallet CTA */}
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-700 shrink-0">
                  <Wallet className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    Want the full experience?
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Connect your wallet for transfers, trading, privacy tools,
                    and more.
                  </p>
                  <a
                    href="/"
                    className="inline-block text-xs text-vibrant-red hover:underline mt-1 cursor-pointer"
                  >
                    Go to dashboard →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

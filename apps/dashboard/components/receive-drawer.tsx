"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import QRCode from "react-qr-code";
import { CopyButton } from "@/components/copy-button";
import { TokenIcon } from "@/components/token-icon";
import { truncate, cn } from "@/lib/utils";
import { SOL_MINT, USDC_MINT } from "@/lib/constants";

interface ReceiveToken {
  mint: string;
  symbol: string;
  logoURI?: string;
}

interface ReceiveDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  /** Optional token to receive - defaults to USDC */
  token?: ReceiveToken | null;
}

function buildSolanaPayUrl(
  address: string,
  tokenMint?: string,
  amount?: number,
): string {
  // For SOL, don't include spl-token parameter
  if (!tokenMint || tokenMint === SOL_MINT) {
    let url = `solana:${address}`;
    if (amount && amount > 0) {
      url += `?amount=${amount}`;
    }
    return url;
  }

  // For SPL tokens
  let url = `solana:${address}?spl-token=${tokenMint}`;
  if (amount && amount > 0) {
    url += `&amount=${amount}`;
  }
  return url;
}

export function ReceiveDrawer({
  isOpen,
  onClose,
  walletAddress,
  token,
}: ReceiveDrawerProps) {
  const [amount, setAmount] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Default to USDC if no token specified
  const selectedToken: ReceiveToken = token ?? {
    mint: USDC_MINT,
    symbol: "USDC",
  };

  const parsedAmount = amount ? parseFloat(amount) : undefined;
  const solanaPayUrl = buildSolanaPayUrl(
    walletAddress,
    selectedToken.mint,
    parsedAmount && !isNaN(parsedAmount) ? parsedAmount : undefined,
  );

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      setVisible(false);
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleTransitionEnd = () => {
    if (!isOpen) {
      setMounted(false);
      setAmount("");
    }
  };

  if (!mounted && !isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        className={cn(
          "absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white dark:bg-neutral-900 rounded-t-2xl transition-transform duration-300 ease-out",
          visible ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <TokenIcon
              symbol={selectedToken.symbol}
              logoURI={selectedToken.logoURI}
              size="sm"
            />
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
              receive {selectedToken.symbol}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
          </button>
        </div>

        <div className="p-4 sm:p-6 pb-8 sm:pb-6 space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-white border border-neutral-200 dark:border-neutral-700 rounded-xl">
              <QRCode value={solanaPayUrl} size={200} level="M" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
              wallet address
            </label>
            <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <span className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
                {truncate(walletAddress)}
              </span>
              <CopyButton value={walletAddress} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
              request amount (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="any"
                className="flex-1 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 font-mono text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-vibrant-red focus-visible:border-vibrant-red"
              />
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {selectedToken.symbol}
              </span>
            </div>
          </div>

          <p className="text-xs text-center text-neutral-400 dark:text-neutral-500">
            scan the QR code with a Solana wallet app
          </p>
        </div>
      </div>
    </div>
  );
}

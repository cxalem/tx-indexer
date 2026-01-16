"use client";

import { useState, useEffect, useRef } from "react";
import {
  MoreHorizontal,
  Send,
  ArrowLeftRight,
  TrendingUp,
  QrCode,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReceiveDrawer } from "@/components/receive-drawer";
import { LabelWalletDrawer } from "@/components/label-wallet-drawer";
import { useAuth } from "@/lib/auth";

interface PortfolioActionsProps {
  walletAddress: string | null;
  onSend?: () => void;
  onTrade?: () => void;
  onEarn?: () => void;
}

const noop = () => {};

export function PortfolioActions({
  walletAddress,
  onSend = noop,
  onTrade = noop,
  onEarn = noop,
}: PortfolioActionsProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [labelDrawerOpen, setLabelDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2" ref={menuRef}>
        {isAuthLoading ? (
          <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
        ) : isAuthenticated ? (
          <button
            type="button"
            onClick={() => setLabelDrawerOpen(true)}
            className={cn(
              "p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer",
              "hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400",
            )}
            title="Label a wallet"
          >
            <Tag className="h-4 w-4" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={onSend}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer",
            "bg-vibrant-red text-white hover:bg-vibrant-red/90",
          )}
        >
          <Send className="h-3.5 w-3.5" />
          send
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={cn(
              "p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer",
              "hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400",
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 min-w-[120px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg py-1">
              <button
                type="button"
                onClick={() => {
                  setReceiveOpen(true);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                <QrCode className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                receive
              </button>
              <button
                type="button"
                onClick={() => {
                  onTrade();
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                trade
              </button>
              <button
                type="button"
                onClick={() => {
                  onEarn();
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-neutral-900 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              >
                <TrendingUp className="h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                earn
              </button>
            </div>
          )}
        </div>
      </div>

      {walletAddress && (
        <ReceiveDrawer
          isOpen={receiveOpen}
          onClose={() => setReceiveOpen(false)}
          walletAddress={walletAddress}
        />
      )}

      <LabelWalletDrawer
        open={labelDrawerOpen}
        onOpenChange={setLabelDrawerOpen}
      />
    </>
  );
}

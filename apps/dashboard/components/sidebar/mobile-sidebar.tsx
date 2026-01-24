"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { Menu, X, QrCode, Send } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { AnimatedPrivacyButtonWrapper } from "./animated-privacy-button";
import { mainNavItems, bottomNavItems } from "./nav-items";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { usePrivacyFeature } from "@/hooks/use-privacy-feature";
import { ThemeToggle } from "@/components/theme-toggle";
import { bitcountFont } from "@/lib/fonts";

const SendTransferDrawer = dynamic(
  () =>
    import("@/components/send-transfer").then((mod) => mod.SendTransferDrawer),
  { ssr: false },
);

const TradeDrawer = dynamic(
  () => import("@/components/trade").then((mod) => mod.TradeDrawer),
  { ssr: false },
);

const ReceiveDrawer = dynamic(
  () => import("@/components/receive-drawer").then((mod) => mod.ReceiveDrawer),
  { ssr: false },
);

const PrivacyDrawer = dynamic(
  () => import("@/components/privacy").then((mod) => mod.PrivacyDrawer),
  { ssr: false },
);

export function MobileSidebar() {
  const { status, address } = useUnifiedWallet();
  const isConnected = status === "connected";
  const {
    isEnabled: isPrivacyEnabled,
    animationTrigger,
    clearAnimation,
  } = usePrivacyFeature();

  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false);
  const [receiveDrawerOpen, setReceiveDrawerOpen] = useState(false);
  const [privacyDrawerOpen, setPrivacyDrawerOpen] = useState(false);

  const sendDrawerMounted = useRef(false);
  const tradeDrawerMounted = useRef(false);
  const receiveDrawerMounted = useRef(false);
  const privacyDrawerMounted = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (sendDrawerOpen) sendDrawerMounted.current = true;
  if (tradeDrawerOpen) tradeDrawerMounted.current = true;
  if (receiveDrawerOpen) receiveDrawerMounted.current = true;
  if (privacyDrawerOpen) privacyDrawerMounted.current = true;

  const { balance, usdcBalance } = useDashboardData(address, {
    fastPolling: false,
  });

  const tokenBalances = useMemo(
    () =>
      balance?.tokens.map((t) => ({
        mint: t.mint,
        symbol: t.symbol,
        uiAmount: t.amount.ui,
      })) ?? [],
    [balance?.tokens],
  );

  const handleAction = useCallback((actionId: string) => {
    setIsOpen(false);
    if (actionId === "trade") {
      setTradeDrawerOpen(true);
    }
  }, []);

  const handleReceive = useCallback(() => {
    setIsOpen(false);
    setReceiveDrawerOpen(true);
  }, []);

  const handleSend = useCallback(() => {
    setIsOpen(false);
    setSendDrawerOpen(true);
  }, []);

  const handlePrivacy = useCallback(() => {
    setIsOpen(false);
    setPrivacyDrawerOpen(true);
  }, []);

  const closeSidebar = useCallback(() => setIsOpen(false), []);
  const closeReceiveDrawer = useCallback(() => setReceiveDrawerOpen(false), []);

  const sidebarContent = (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[998] md:hidden"
          onClick={closeSidebar}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-neutral-900 z-[999] transform transition-transform duration-200 ease-out md:hidden flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h1
            className={`${bitcountFont.className} text-xl text-neutral-900 dark:text-neutral-100`}
          >
            <span className="text-vibrant-red">{"//"}</span> dashboard
          </h1>
          <button
            onClick={closeSidebar}
            className="p-1 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-3">
          <SidebarNav items={mainNavItems} onAction={handleAction} />
        </div>

        {isConnected && (
          <div className="px-3 pb-3 space-y-2">
            <button
              type="button"
              onClick={handleReceive}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer w-full border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <QrCode className="w-4 h-4" />
              <span className="lowercase">receive</span>
            </button>
            <AnimatedPrivacyButtonWrapper
              isEnabled={isPrivacyEnabled}
              animationTrigger={animationTrigger}
              onClick={handlePrivacy}
              onAnimationComplete={clearAnimation}
            />
            <button
              type="button"
              onClick={handleSend}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer w-full bg-vibrant-red text-white hover:bg-vibrant-red/90"
            >
              <Send className="w-4 h-4" />
              <span className="lowercase">send</span>
            </button>
          </div>
        )}

        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <SidebarNav items={bottomNavItems} onAction={handleAction} />
          <ThemeToggle />
        </div>
      </div>

      {sendDrawerMounted.current && (
        <SendTransferDrawer
          open={sendDrawerOpen}
          onOpenChange={setSendDrawerOpen}
          usdcBalance={usdcBalance}
        />
      )}

      {tradeDrawerMounted.current && (
        <TradeDrawer
          open={tradeDrawerOpen}
          onOpenChange={setTradeDrawerOpen}
          solBalance={balance?.sol.ui}
          tokenBalances={tokenBalances}
        />
      )}

      {receiveDrawerMounted.current && address && (
        <ReceiveDrawer
          isOpen={receiveDrawerOpen}
          onClose={closeReceiveDrawer}
          walletAddress={address}
        />
      )}

      {privacyDrawerMounted.current && (
        <PrivacyDrawer
          open={privacyDrawerOpen}
          onOpenChange={setPrivacyDrawerOpen}
        />
      )}
    </>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 -ml-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {mounted && createPortal(sidebarContent, document.body)}
    </>
  );
}

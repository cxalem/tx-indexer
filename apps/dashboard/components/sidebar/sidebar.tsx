"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import localFont from "next/font/local";
import { QrCode, Send } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { mainNavItems, bottomNavItems } from "./nav-items";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { ThemeToggle } from "@/components/theme-toggle";

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

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export function Sidebar() {
  const { status, address } = useUnifiedWallet();
  const isConnected = status === "connected";

  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false);
  const [receiveDrawerOpen, setReceiveDrawerOpen] = useState(false);

  const sendDrawerMounted = useRef(false);
  const tradeDrawerMounted = useRef(false);
  const receiveDrawerMounted = useRef(false);

  if (sendDrawerOpen) sendDrawerMounted.current = true;
  if (tradeDrawerOpen) tradeDrawerMounted.current = true;
  if (receiveDrawerOpen) receiveDrawerMounted.current = true;

  const { balance, usdcBalance } = useDashboardData(address, {
    fastPolling: false,
  });

  const tokenBalances =
    balance?.tokens.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      uiAmount: t.amount.ui,
    })) ?? [];

  const handleAction = (actionId: string) => {
    if (actionId === "trade") {
      setTradeDrawerOpen(true);
    }
  };

  return (
    <>
      <aside className="hidden md:flex flex-col w-56 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 fixed top-0 left-0 h-screen overflow-y-auto z-30">
        {/* Logo */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h1
            className={`${bitcountFont.className} text-xl text-neutral-900 dark:text-neutral-100`}
          >
            <span className="text-vibrant-red">{"//"}</span> dashboard
          </h1>
        </div>

        {/* Main nav */}
        <div className="flex-1 p-3">
          <SidebarNav items={mainNavItems} onAction={handleAction} />
        </div>

        {/* Receive & Send buttons */}
        {isConnected && (
          <div className="px-3 pb-3 space-y-2">
            <button
              type="button"
              onClick={() => setReceiveDrawerOpen(true)}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer w-full border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <QrCode className="w-4 h-4" />
              <span className="lowercase">receive</span>
            </button>
            <button
              type="button"
              onClick={() => setSendDrawerOpen(true)}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer w-full bg-vibrant-red text-white hover:bg-vibrant-red/90"
            >
              <Send className="w-4 h-4" />
              <span className="lowercase">send</span>
            </button>
          </div>
        )}

        {/* Bottom nav */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <SidebarNav items={bottomNavItems} onAction={handleAction} />
          <ThemeToggle />
        </div>
      </aside>

      {/* Drawers */}
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
          onClose={() => setReceiveDrawerOpen(false)}
          walletAddress={address}
        />
      )}
    </>
  );
}

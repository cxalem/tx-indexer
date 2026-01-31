"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, useAnimationControls } from "framer-motion";
import { QrCode, Send } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { AnimatedPrivacyButtonWrapper } from "./animated-privacy-button";
import { mainNavItems, bottomNavItems } from "./nav-items";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { usePrivacyFeature } from "@/hooks/use-privacy-feature";
import { ThemeToggle } from "@/components/theme-toggle";
import { bitcountFont } from "@/lib/fonts";
import { getTokenInfo, KNOWN_TOKENS } from "tx-indexer";
import { SOL_MINT } from "@/lib/constants";
import type { SendableToken } from "@/components/send-transfer/token-selector";

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

interface SidebarActionButtonsProps {
  animationTrigger: "enter" | "exit" | null;
  isPrivacyEnabled: boolean;
  onReceiveClick: () => void;
  onPrivacyClick: () => void;
  onSendClick: () => void;
  onAnimationComplete: () => void;
}

function SidebarActionButtons({
  animationTrigger,
  isPrivacyEnabled,
  onReceiveClick,
  onPrivacyClick,
  onSendClick,
  onAnimationComplete,
}: SidebarActionButtonsProps) {
  const receiveControls = useAnimationControls();

  useEffect(() => {
    if (animationTrigger === "exit") {
      receiveControls.start({
        y: [0, 4, 6, 4, 0, -3, 0, -1, 0],
        transition: {
          duration: 0.9,
          times: [0, 0.15, 0.35, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
          ease: "easeOut",
        },
      });
    } else if (animationTrigger === "enter") {
      receiveControls.start({
        y: [0, -2, -4, -3, 0],
        transition: {
          duration: 1.0,
          times: [0, 0.2, 0.5, 0.75, 1],
          ease: "easeInOut",
        },
      });
    }
  }, [animationTrigger, receiveControls]);

  return (
    <div className="px-3 pb-3 space-y-2">
      <motion.button
        type="button"
        onClick={onReceiveClick}
        animate={receiveControls}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer w-full border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        <QrCode className="w-4 h-4" />
        <span className="lowercase">receive</span>
      </motion.button>
      <AnimatedPrivacyButtonWrapper
        isEnabled={isPrivacyEnabled}
        animationTrigger={animationTrigger}
        onClick={onPrivacyClick}
        onAnimationComplete={onAnimationComplete}
      />
      <button
        type="button"
        onClick={onSendClick}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer w-full bg-vibrant-red text-white hover:bg-vibrant-red/90"
      >
        <Send className="w-4 h-4" />
        <span className="lowercase">send</span>
      </button>
    </div>
  );
}

export function Sidebar() {
  const { status, address } = useUnifiedWallet();
  const isConnected = status === "connected";
  const {
    isEnabled: isPrivacyEnabled,
    animationTrigger,
    clearAnimation,
  } = usePrivacyFeature();

  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false);
  const [receiveDrawerOpen, setReceiveDrawerOpen] = useState(false);
  const [privacyDrawerOpen, setPrivacyDrawerOpen] = useState(false);

  const sendDrawerMounted = useRef(false);
  const tradeDrawerMounted = useRef(false);
  const receiveDrawerMounted = useRef(false);
  const privacyDrawerMounted = useRef(false);

  if (sendDrawerOpen) sendDrawerMounted.current = true;
  if (tradeDrawerOpen) tradeDrawerMounted.current = true;
  if (receiveDrawerOpen) receiveDrawerMounted.current = true;
  if (privacyDrawerOpen) privacyDrawerMounted.current = true;

  const { balance } = useDashboardData(address, {
    fastPolling: false,
  });

  // Stablecoin mints that we assume are ~$1
  const STABLECOIN_MINTS: Set<string> = useMemo(
    () =>
      new Set([
        KNOWN_TOKENS.USDC,
        KNOWN_TOKENS.USDT,
        KNOWN_TOKENS.PYUSD,
        KNOWN_TOKENS.USDG,
      ]),
    [],
  );

  // Map balance tokens to SendableToken format for the send drawer
  // Include SOL as a synthetic token since balance.tokens only has SPL tokens
  const sendableTokens = useMemo((): SendableToken[] => {
    if (!balance) return [];

    const tokens: SendableToken[] = [];

    // Add SOL first
    if (balance.sol.ui > 0) {
      const solInfo = getTokenInfo(SOL_MINT);
      tokens.push({
        mint: SOL_MINT,
        symbol: "SOL",
        name: solInfo?.name ?? "Solana",
        decimals: 9,
        logoURI: solInfo?.logoURI,
        balance: balance.sol.ui,
        price: null,
      });
    }

    // Add SPL tokens
    for (const t of balance.tokens) {
      const tokenInfo = getTokenInfo(t.mint);
      const price = STABLECOIN_MINTS.has(t.mint) ? 1.0 : null;

      tokens.push({
        mint: t.mint,
        symbol: t.symbol,
        name: tokenInfo?.name ?? t.symbol,
        decimals: t.decimals,
        logoURI: tokenInfo?.logoURI,
        balance: t.amount.ui,
        price,
      });
    }

    return tokens;
  }, [balance, STABLECOIN_MINTS]);

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
    if (actionId === "trade") {
      setTradeDrawerOpen(true);
    }
  }, []);

  const openReceiveDrawer = useCallback(() => setReceiveDrawerOpen(true), []);
  const openSendDrawer = useCallback(() => setSendDrawerOpen(true), []);
  const openPrivacyDrawer = useCallback(() => setPrivacyDrawerOpen(true), []);
  const closeReceiveDrawer = useCallback(() => setReceiveDrawerOpen(false), []);

  useEffect(() => {
    function handlePrivacyOpen() {
      setPrivacyDrawerOpen(true);
    }
    window.addEventListener("privacy:open", handlePrivacyOpen);
    return () => window.removeEventListener("privacy:open", handlePrivacyOpen);
  }, []);

  return (
    <>
      <aside className="hidden md:flex flex-col w-56 fixed top-0 left-0 h-screen overflow-y-auto z-30">
        <div className="p-4">
          <h1
            className={`${bitcountFont.className} text-xl text-neutral-900 dark:text-neutral-100`}
          >
            <span className="text-vibrant-red">{"//"}</span> dashboard
          </h1>
        </div>

        <div className="flex-1 p-3">
          <SidebarNav items={mainNavItems} onAction={handleAction} />
        </div>

        {isConnected && (
          <SidebarActionButtons
            animationTrigger={animationTrigger}
            isPrivacyEnabled={isPrivacyEnabled}
            onReceiveClick={openReceiveDrawer}
            onPrivacyClick={openPrivacyDrawer}
            onSendClick={openSendDrawer}
            onAnimationComplete={clearAnimation}
          />
        )}

        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <SidebarNav items={bottomNavItems} onAction={handleAction} />
          <ThemeToggle />
        </div>
      </aside>

      {sendDrawerMounted.current && (
        <SendTransferDrawer
          open={sendDrawerOpen}
          onOpenChange={setSendDrawerOpen}
          tokens={sendableTokens}
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
}

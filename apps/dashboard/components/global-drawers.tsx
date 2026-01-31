"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useDrawer } from "@/contexts/drawer-context";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useDashboardData } from "@/hooks/use-dashboard-data";
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

// Stablecoin mints that we assume are ~$1
const STABLECOIN_MINTS: Set<string> = new Set([
  KNOWN_TOKENS.USDC,
  KNOWN_TOKENS.USDT,
  KNOWN_TOKENS.PYUSD,
  KNOWN_TOKENS.USDG,
]);

/**
 * Global drawers that can be opened from anywhere in the app
 * using the useDrawer() hook
 */
export function GlobalDrawers() {
  const { address } = useUnifiedWallet();
  const { balance } = useDashboardData(address);

  const {
    sendDrawerOpen,
    sendToken,
    closeSendDrawer,
    tradeDrawerOpen,
    tradeToken,
    closeTradeDrawer,
    receiveDrawerOpen,
    receiveToken,
    closeReceiveDrawer,
  } = useDrawer();

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
        price: null, // Will be fetched by the hook
      });
    }

    // Add SPL tokens
    for (const t of balance.tokens) {
      const tokenInfo = getTokenInfo(t.mint);
      // Assume stablecoins are $1, others are unknown
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
  }, [balance]);

  // Get token balances for trade drawer
  const tokenBalances =
    balance?.tokens.map((t) => ({
      mint: t.mint,
      symbol: t.symbol,
      uiAmount: t.amount.ui,
    })) ?? [];

  return (
    <>
      <SendTransferDrawer
        open={sendDrawerOpen}
        onOpenChange={(open) => !open && closeSendDrawer()}
        tokens={sendableTokens}
        initialTokenMint={sendToken?.mint}
      />

      <TradeDrawer
        open={tradeDrawerOpen}
        onOpenChange={(open) => !open && closeTradeDrawer()}
        solBalance={balance?.sol.ui}
        tokenBalances={tokenBalances}
        initialInputMint={tradeToken?.mint}
      />

      {address && (
        <ReceiveDrawer
          isOpen={receiveDrawerOpen}
          onClose={closeReceiveDrawer}
          walletAddress={address}
          token={receiveToken}
        />
      )}
    </>
  );
}

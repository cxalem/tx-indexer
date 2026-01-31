"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface DrawerToken {
  mint: string;
  symbol: string;
  name?: string;
  logoURI?: string;
  decimals?: number;
  balance?: number;
}

interface DrawerContextValue {
  // Send drawer
  sendDrawerOpen: boolean;
  sendToken: DrawerToken | null;
  openSendDrawer: (token?: DrawerToken) => void;
  closeSendDrawer: () => void;

  // Trade drawer
  tradeDrawerOpen: boolean;
  tradeToken: DrawerToken | null;
  openTradeDrawer: (token?: DrawerToken) => void;
  closeTradeDrawer: () => void;

  // Receive drawer
  receiveDrawerOpen: boolean;
  receiveToken: DrawerToken | null;
  openReceiveDrawer: (token?: DrawerToken) => void;
  closeReceiveDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  // Send drawer state
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  const [sendToken, setSendToken] = useState<DrawerToken | null>(null);

  // Trade drawer state
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false);
  const [tradeToken, setTradeToken] = useState<DrawerToken | null>(null);

  // Receive drawer state
  const [receiveDrawerOpen, setReceiveDrawerOpen] = useState(false);
  const [receiveToken, setReceiveToken] = useState<DrawerToken | null>(null);

  const openSendDrawer = useCallback((token?: DrawerToken) => {
    setSendToken(token ?? null);
    setSendDrawerOpen(true);
  }, []);

  const closeSendDrawer = useCallback(() => {
    setSendDrawerOpen(false);
    // Clear token after animation completes
    setTimeout(() => setSendToken(null), 300);
  }, []);

  const openTradeDrawer = useCallback((token?: DrawerToken) => {
    setTradeToken(token ?? null);
    setTradeDrawerOpen(true);
  }, []);

  const closeTradeDrawer = useCallback(() => {
    setTradeDrawerOpen(false);
    setTimeout(() => setTradeToken(null), 300);
  }, []);

  const openReceiveDrawer = useCallback((token?: DrawerToken) => {
    setReceiveToken(token ?? null);
    setReceiveDrawerOpen(true);
  }, []);

  const closeReceiveDrawer = useCallback(() => {
    setReceiveDrawerOpen(false);
    setTimeout(() => setReceiveToken(null), 300);
  }, []);

  return (
    <DrawerContext.Provider
      value={{
        sendDrawerOpen,
        sendToken,
        openSendDrawer,
        closeSendDrawer,
        tradeDrawerOpen,
        tradeToken,
        openTradeDrawer,
        closeTradeDrawer,
        receiveDrawerOpen,
        receiveToken,
        openReceiveDrawer,
        closeReceiveDrawer,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) {
    throw new Error("useDrawer must be used within a DrawerProvider");
  }
  return context;
}

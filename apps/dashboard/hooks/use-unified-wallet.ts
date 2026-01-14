"use client";

import { useWallet } from "@solana/react-hooks";
import { useState, useEffect, useCallback } from "react";
import {
  getStoredSession,
  clearAllMobileWalletData,
} from "@/lib/mobile-wallet/session-storage";

export type UnifiedWalletStatus = "disconnected" | "connected";

export interface UnifiedWalletState {
  status: UnifiedWalletStatus;
  address: string | null;
  connectionType: "desktop" | "mobile" | null;
  disconnectMobile: () => void;
}

export function useUnifiedWallet(): UnifiedWalletState {
  const desktopWallet = useWallet();
  const [mobileAddress, setMobileAddress] = useState<string | null>(null);

  useEffect(() => {
    const storedSession = getStoredSession();
    if (storedSession) {
      setMobileAddress(storedSession.publicKey);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "phantom_wallet_session") {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            setMobileAddress(parsed.publicKey);
          } catch {
            setMobileAddress(null);
          }
        } else {
          setMobileAddress(null);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const refreshMobileSession = useCallback(() => {
    const storedSession = getStoredSession();
    setMobileAddress(storedSession?.publicKey ?? null);
  }, []);

  useEffect(() => {
    refreshMobileSession();
  }, [refreshMobileSession]);

  const disconnectMobile = useCallback(() => {
    clearAllMobileWalletData();
    setMobileAddress(null);
  }, []);

  const isDesktopConnected = desktopWallet.status === "connected";
  const isMobileConnected = mobileAddress !== null;

  if (isDesktopConnected) {
    return {
      status: "connected",
      address: desktopWallet.session.account.address.toString(),
      connectionType: "desktop",
      disconnectMobile,
    };
  }

  if (isMobileConnected) {
    return {
      status: "connected",
      address: mobileAddress,
      connectionType: "mobile",
      disconnectMobile,
    };
  }

  return {
    status: "disconnected",
    address: null,
    connectionType: null,
    disconnectMobile,
  };
}

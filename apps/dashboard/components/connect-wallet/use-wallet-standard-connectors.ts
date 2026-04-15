"use client";

import {
  getWalletStandardConnectors,
  watchWalletStandardConnectors,
} from "@solana/client";
import { useEffect, useState } from "react";

export interface DetectedWallet {
  id: string;
  name: string;
  icon?: string;
}

function toDetected(
  connectors: ReadonlyArray<{ id: string; name: string; icon?: string }>,
): DetectedWallet[] {
  const seen = new Set<string>();
  const out: DetectedWallet[] = [];
  for (const c of connectors) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, name: c.name, icon: c.icon });
  }
  return out;
}

export function useWalletStandardConnectors(): DetectedWallet[] {
  const [wallets, setWallets] = useState<DetectedWallet[]>(() => {
    if (typeof window === "undefined") return [];
    return toDetected(getWalletStandardConnectors());
  });

  useEffect(() => {
    setWallets(toDetected(getWalletStandardConnectors()));
    const unsubscribe = watchWalletStandardConnectors((connectors) => {
      setWallets(toDetected(connectors));
    });
    return unsubscribe;
  }, []);

  return wallets;
}

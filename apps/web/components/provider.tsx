"use client";

import type { SolanaClientConfig } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";
import type { PropsWithChildren } from "react";

const defaultConfig: SolanaClientConfig = {
  // Use public RPC URL for client-side wallet operations (domain-restricted key)
  // Falls back to public mainnet RPC during build time when env may not be available
  endpoint:
    process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
};

export function Providers({ children }: PropsWithChildren) {
  return <SolanaProvider config={defaultConfig}>{children}</SolanaProvider>;
}

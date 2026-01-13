"use client";

import type { SolanaClientConfig } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type PropsWithChildren } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";

const config: SolanaClientConfig = {
  // Use public RPC URL for client-side wallet operations (domain-restricted key)
  endpoint: process.env.NEXT_PUBLIC_RPC_URL!,
};

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Refetch on window focus for instant updates when user comes back
            refetchOnWindowFocus: true,
            // Keep data fresh longer to reduce RPC calls
            staleTime: 30 * 1000, // 30 seconds
            // Retry failed requests with backoff
            retry: 1,
            // Add delay between retries
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 30000),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SolanaProvider config={config}>
        <AuthProvider>
          {children}
          <Toaster position="bottom-right" richColors />
        </AuthProvider>
      </SolanaProvider>
    </QueryClientProvider>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { getWalletLabels, type WalletLabel } from "@/app/actions/wallet-labels";
import { useAuth } from "@/lib/auth";

interface UseWalletLabelsReturn {
  labels: Map<string, string>;
  isLoading: boolean;
  getLabel: (address: string) => string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and cache wallet labels.
 * Labels are stored in a Map for O(1) lookup.
 */
export function useWalletLabels(): UseWalletLabelsReturn {
  const { isAuthenticated } = useAuth();
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const fetchLabels = useCallback(async () => {
    if (!isAuthenticated) {
      setLabels(new Map());
      return;
    }

    setIsLoading(true);
    try {
      const walletLabels = await getWalletLabels();
      const labelMap = new Map<string, string>();
      for (const label of walletLabels) {
        labelMap.set(label.address, label.label);
      }
      setLabels(labelMap);
    } catch (error) {
      console.error("Failed to fetch wallet labels:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch labels on mount and when auth changes
  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const getLabel = useCallback(
    (address: string): string | null => {
      return labels.get(address) ?? null;
    },
    [labels],
  );

  return {
    labels,
    isLoading,
    getLabel,
    refresh: fetchLabels,
  };
}

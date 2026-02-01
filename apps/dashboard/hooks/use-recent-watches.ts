"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "recent-watched-wallets";
const MAX_RECENT = 5;

export interface RecentWatch {
  address: string;
  timestamp: number;
}

/**
 * Hook to manage recently watched wallets in localStorage
 */
export function useRecentWatches() {
  const [recentWatches, setRecentWatches] = useState<RecentWatch[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentWatch[];
        setRecentWatches(parsed);
      }
    } catch (error) {
      console.error("Failed to load recent watches:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage
  const saveToStorage = useCallback((watches: RecentWatch[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watches));
    } catch (error) {
      console.error("Failed to save recent watches:", error);
    }
  }, []);

  // Add a wallet to recent watches
  const addRecentWatch = useCallback(
    (address: string) => {
      setRecentWatches((prev) => {
        // Remove if already exists
        const filtered = prev.filter(
          (w) => w.address.toLowerCase() !== address.toLowerCase(),
        );

        // Add to front
        const updated = [{ address, timestamp: Date.now() }, ...filtered].slice(
          0,
          MAX_RECENT,
        );

        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage],
  );

  // Remove a wallet from recent watches
  const removeRecentWatch = useCallback(
    (address: string) => {
      setRecentWatches((prev) => {
        const updated = prev.filter(
          (w) => w.address.toLowerCase() !== address.toLowerCase(),
        );
        saveToStorage(updated);
        return updated;
      });
    },
    [saveToStorage],
  );

  // Clear all recent watches
  const clearRecentWatches = useCallback(() => {
    setRecentWatches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear recent watches:", error);
    }
  }, []);

  return {
    recentWatches,
    isLoaded,
    addRecentWatch,
    removeRecentWatch,
    clearRecentWatches,
  };
}

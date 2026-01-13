"use client";

import { useState, useEffect } from "react";
import { Bell, Loader2, X } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "notification-banner-dismissed";

export function NotificationBanner() {
  const { permission, isSupported, requestPermission } = useNotifications();
  const [isDismissed, setIsDismissed] = useState(true); // Start dismissed to prevent flash
  const [isRequesting, setIsRequesting] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    setIsDismissed(dismissed === "true");
  }, []);

  // Don't show if not supported, already granted, or dismissed
  if (!isSupported || permission === "granted" || isDismissed) {
    return null;
  }

  // Don't show if permission was explicitly denied (browser won't allow re-prompting)
  if (permission === "denied") {
    return null;
  }

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      await requestPermission();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "true");
  };

  return (
    <div className="mb-4 p-4 rounded-lg bg-neutral-50 border border-neutral-200 relative">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-center gap-2 mb-3 pr-6">
        <Bell className="h-4 w-4 text-neutral-500" />
        <p className="text-sm font-medium text-neutral-700">
          enable notifications?
        </p>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        Get notified when you receive transactions, even when this tab is in the
        background.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-1 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
        >
          not now
        </button>
        <button
          type="button"
          onClick={handleEnable}
          disabled={isRequesting}
          className={cn(
            "flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center justify-center gap-1",
            !isRequesting
              ? "bg-vibrant-red text-white hover:bg-vibrant-red/90 cursor-pointer"
              : "bg-neutral-200 text-neutral-400 cursor-not-allowed",
          )}
        >
          {isRequesting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Bell className="h-3 w-3" />
          )}
          {isRequesting ? "enabling..." : "enable"}
        </button>
      </div>
    </div>
  );
}

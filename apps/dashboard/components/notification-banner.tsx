"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
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
    <div className="mb-4 border border-blue-200 bg-blue-50 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-100">
          <Bell className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900">
            Enable notifications
          </p>
          <p className="text-sm text-blue-700 mt-0.5">
            Get notified when you receive transactions, even when this tab is in
            the background.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleEnable}
              disabled={isRequesting}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md",
                "bg-blue-600 text-white hover:bg-blue-700",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors cursor-pointer",
              )}
            >
              {isRequesting ? "Requesting..." : "Enable"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors cursor-pointer"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

export type NotificationPermission = "default" | "granted" | "denied";

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
}

interface UseNotificationsReturn {
  permission: NotificationPermission;
  isSupported: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  sendNotification: (options: NotificationOptions) => void;
}

/**
 * Hook to manage browser notifications (Web Notifications API).
 * Handles permission requests and sending notifications.
 */
export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  // Check if notifications are supported and get current permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setIsSupported(true);
      setPermission(Notification.permission as NotificationPermission);
    }
  }, []);

  const requestPermission =
    useCallback(async (): Promise<NotificationPermission> => {
      if (!isSupported) {
        return "denied";
      }

      try {
        const result = await Notification.requestPermission();
        setPermission(result as NotificationPermission);
        return result as NotificationPermission;
      } catch (error) {
        console.error("Failed to request notification permission:", error);
        return "denied";
      }
    }, [isSupported]);

  const sendNotification = useCallback(
    (options: NotificationOptions) => {
      if (!isSupported || permission !== "granted") {
        return;
      }

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon ?? "/favicon.ico",
          tag: options.tag,
        });

        // Focus the tab when notification is clicked
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error("Failed to send notification:", error);
      }
    },
    [isSupported, permission],
  );

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
  };
}

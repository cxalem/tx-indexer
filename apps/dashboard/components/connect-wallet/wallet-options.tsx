"use client";

import { Smartphone, QrCode } from "lucide-react";
import {
  DESKTOP_CONNECTORS,
  MOBILE_WALLETS,
  type ConnectionMode,
} from "./constants";

interface WalletOptionsProps {
  connectionMode: ConnectionMode;
  showDesktopOptions: boolean;
  showMobileOptions: boolean;
  showPWAOptions: boolean;
  onDesktopConnect: (connectorId: string) => void;
  onMobileConnect: (walletId: string) => void;
  onOpenInWallet: () => void;
}

export function WalletOptions({
  connectionMode,
  showDesktopOptions,
  showMobileOptions,
  showPWAOptions,
  onDesktopConnect,
  onMobileConnect,
  onOpenInWallet,
}: WalletOptionsProps) {
  return (
    <div className="pb-2">
      {showDesktopOptions && (
        <>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-2">
            browser wallets
          </p>
          <div className="space-y-1">
            {DESKTOP_CONNECTORS.map((connector) => (
              <button
                key={connector.id}
                type="button"
                role="menuitem"
                onClick={() => onDesktopConnect(connector.id)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex justify-between items-center cursor-pointer text-neutral-900 dark:text-neutral-100"
              >
                <span>{connector.label}</span>
                <span
                  className="text-neutral-400 dark:text-neutral-500"
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {showMobileOptions && (
        <>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-2">
            mobile wallets
          </p>
          <div className="space-y-1">
            {MOBILE_WALLETS.map((mobileWallet) => (
              <button
                key={mobileWallet.id}
                type="button"
                role="menuitem"
                onClick={() => onMobileConnect(mobileWallet.id)}
                className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex justify-between items-center cursor-pointer text-neutral-900 dark:text-neutral-100"
              >
                <div className="flex items-center gap-2">
                  <Smartphone
                    className="h-4 w-4 text-neutral-400 dark:text-neutral-500"
                    aria-hidden="true"
                  />
                  <span>{mobileWallet.label}</span>
                </div>
                <span
                  className="text-neutral-400 dark:text-neutral-500"
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={onOpenInWallet}
              className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex justify-between items-center cursor-pointer text-neutral-500 dark:text-neutral-400"
            >
              <span>open in wallet browser</span>
              <span
                className="text-neutral-400 dark:text-neutral-500"
                aria-hidden="true"
              >
                →
              </span>
            </button>
          </div>
        </>
      )}

      {showPWAOptions && (
        <>
          <div className="px-3 py-2">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
              For the best experience, open this app in your wallet&apos;s
              browser
            </p>
          </div>
          <div className="space-y-1">
            <button
              type="button"
              role="menuitem"
              onClick={onOpenInWallet}
              className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex justify-between items-center cursor-pointer text-neutral-900 dark:text-neutral-100"
            >
              <div className="flex items-center gap-2">
                <Smartphone
                  className="h-4 w-4 text-neutral-400 dark:text-neutral-500"
                  aria-hidden="true"
                />
                <span>open in Phantom</span>
              </div>
              <span
                className="text-neutral-400 dark:text-neutral-500"
                aria-hidden="true"
              >
                →
              </span>
            </button>
          </div>
        </>
      )}

      {connectionMode === "desktop" && (
        <div className="border-t border-neutral-100 dark:border-neutral-700 mt-2 pt-2">
          <button
            type="button"
            role="menuitem"
            disabled
            className="w-full px-3 py-2 text-sm text-left flex justify-between items-center cursor-not-allowed text-neutral-400 dark:text-neutral-500"
          >
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4" aria-hidden="true" />
              <span>scan with mobile</span>
            </div>
            <span
              className="text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded"
              aria-label="Coming soon"
            >
              soon
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

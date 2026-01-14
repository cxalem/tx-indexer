"use client";

import { useState, useEffect, useCallback } from "react";
import QRCode from "react-qr-code";
import { X, RefreshCw, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createEphemeralKeypair,
  buildPhantomConnectUrl,
} from "@/lib/mobile-wallet/phantom-deeplink";
import { storeKeypair } from "@/lib/mobile-wallet/session-storage";

interface QrWalletConnectProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl?: string;
  cluster?: "mainnet-beta" | "devnet" | "testnet";
}

const QR_REFRESH_INTERVAL = 60000;

export function QrWalletConnect({
  isOpen,
  onClose,
  appUrl,
  cluster = "mainnet-beta",
}: QrWalletConnectProps) {
  const [connectUrl, setConnectUrl] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  const baseUrl =
    appUrl ?? (typeof window !== "undefined" ? window.location.origin : "");

  const generateNewQr = useCallback(() => {
    const keypair = createEphemeralKeypair();
    storeKeypair(keypair);

    const redirectUrl = `${baseUrl}/wallet-callback?type=connect`;
    const url = buildPhantomConnectUrl({
      cluster,
      appUrl: baseUrl,
      redirectUrl,
      encryptionPublicKey: keypair.publicKey,
    });

    setConnectUrl(url);
  }, [baseUrl, cluster]);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      generateNewQr();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else {
      setVisible(false);
    }
  }, [isOpen, generateNewQr]);

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(generateNewQr, QR_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [isOpen, generateNewQr]);

  const handleTransitionEnd = () => {
    if (!isOpen) {
      setMounted(false);
      setConnectUrl("");
    }
  };

  if (!mounted && !isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={cn(
            "w-full max-w-sm bg-white rounded-2xl transition-transform duration-300 ease-out",
            visible ? "scale-100" : "scale-95",
          )}
        >
          <div className="flex items-center justify-between p-4 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-neutral-600" />
              <h2 className="text-lg font-medium">scan with mobile</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <X className="h-5 w-5 text-neutral-500" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-white border border-neutral-200 rounded-xl">
                {connectUrl ? (
                  <QRCode value={connectUrl} size={200} level="M" />
                ) : (
                  <div className="w-[200px] h-[200px] bg-neutral-100 animate-pulse rounded" />
                )}
              </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-neutral-600">
                open Phantom on your phone and scan this QR code
              </p>
              <p className="text-xs text-neutral-400">
                make sure you&apos;re on the same network
              </p>
            </div>

            <button
              type="button"
              onClick={generateNewQr}
              className="flex items-center justify-center gap-2 w-full p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm">refresh QR code</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

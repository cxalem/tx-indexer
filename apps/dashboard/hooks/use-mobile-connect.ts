"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  MobileWalletSession,
  MobileConnectionStatus,
  EphemeralKeypair,
} from "@/lib/mobile-wallet/types";
import {
  createEphemeralKeypair,
  buildPhantomConnectUrl,
  buildPhantomSignMessageUrl,
  buildPhantomBrowseUrl,
  parsePhantomConnectCallback,
  parsePhantomSignMessageCallback,
  isPhantomErrorResponse,
  parsePhantomError,
} from "@/lib/mobile-wallet/phantom-deeplink";
import {
  storeKeypair,
  getStoredKeypair,
  storeSession,
  getStoredSession,
  clearAllMobileWalletData,
} from "@/lib/mobile-wallet/session-storage";

const DEFAULT_CLUSTER = "mainnet-beta" as const;

interface UseMobileConnectOptions {
  appUrl?: string;
  cluster?: "mainnet-beta" | "devnet" | "testnet";
}

interface UseMobileConnectReturn {
  status: MobileConnectionStatus;
  session: MobileWalletSession | null;
  publicKey: string | null;
  error: string | null;
  connect: () => void;
  connectWithBrowse: () => void;
  signMessage: (message: Uint8Array) => void;
  disconnect: () => void;
  handleCallback: (
    searchParams: URLSearchParams,
    callbackType: CallbackType,
  ) => void;
  isConnected: boolean;
  isConnecting: boolean;
}

type CallbackType = "connect" | "signMessage" | "signTransaction";

export function useMobileConnect(
  options: UseMobileConnectOptions = {},
): UseMobileConnectReturn {
  const [status, setStatus] = useState<MobileConnectionStatus>("disconnected");
  const [session, setSession] = useState<MobileWalletSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingKeypair, setPendingKeypair] = useState<EphemeralKeypair | null>(
    null,
  );

  const appUrl =
    options.appUrl ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const cluster = options.cluster ?? DEFAULT_CLUSTER;

  useEffect(() => {
    const storedSession = getStoredSession();
    if (storedSession) {
      setSession(storedSession);
      setStatus("connected");
    }

    const storedKeypair = getStoredKeypair();
    if (storedKeypair) {
      setPendingKeypair(storedKeypair);
    }
  }, []);

  const connect = useCallback(() => {
    setError(null);
    setStatus("connecting");

    const keypair = createEphemeralKeypair();
    setPendingKeypair(keypair);
    storeKeypair(keypair);

    const redirectUrl = `${appUrl}/wallet-callback?type=connect`;
    const connectUrl = buildPhantomConnectUrl({
      cluster,
      appUrl,
      redirectUrl,
      encryptionPublicKey: keypair.publicKey,
    });

    window.location.href = connectUrl;
  }, [appUrl, cluster]);

  const connectWithBrowse = useCallback(() => {
    const browseUrl = buildPhantomBrowseUrl(appUrl);
    window.location.href = browseUrl;
  }, [appUrl]);

  const signMessage = useCallback(
    (message: Uint8Array) => {
      if (!session || !pendingKeypair) {
        setError("No active session");
        return;
      }

      setError(null);
      setStatus("signing");

      const redirectUrl = `${appUrl}/wallet-callback?type=signMessage`;
      const signUrl = buildPhantomSignMessageUrl({
        message,
        redirectUrl,
        encryptionPublicKey: pendingKeypair.publicKey,
        session: session.phantomSession,
        sharedSecret: session.sharedSecret,
      });

      window.location.href = signUrl;
    },
    [session, pendingKeypair, appUrl],
  );

  const disconnect = useCallback(() => {
    clearAllMobileWalletData();
    setSession(null);
    setPendingKeypair(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  const handleCallback = useCallback(
    (searchParams: URLSearchParams, callbackType: CallbackType) => {
      if (isPhantomErrorResponse(searchParams)) {
        const phantomError = parsePhantomError(searchParams);
        setError(phantomError.message);
        setStatus("error");
        return;
      }

      const storedKeypair = pendingKeypair ?? getStoredKeypair();
      if (!storedKeypair) {
        setError("No keypair found for callback");
        setStatus("error");
        return;
      }

      try {
        switch (callbackType) {
          case "connect": {
            const result = parsePhantomConnectCallback(
              searchParams,
              storedKeypair.secretKey,
            );
            const newSession: MobileWalletSession = {
              publicKey: result.publicKey,
              phantomSession: result.session,
              sharedSecret: result.sharedSecret,
              phantomEncryptionPublicKey: result.phantomEncryptionPublicKey,
            };
            setSession(newSession);
            storeSession(newSession);
            setStatus("connected");
            break;
          }
          case "signMessage": {
            const currentSession = session ?? getStoredSession();
            if (!currentSession) {
              throw new Error("No session found for sign message callback");
            }
            parsePhantomSignMessageCallback(
              searchParams,
              currentSession.sharedSecret,
            );
            setStatus("connected");
            break;
          }
          default:
            break;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to handle callback";
        setError(message);
        setStatus("error");
      }
    },
    [pendingKeypair, session],
  );

  return {
    status,
    session,
    publicKey: session?.publicKey ?? null,
    error,
    connect,
    connectWithBrowse,
    signMessage,
    disconnect,
    handleCallback,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
  };
}

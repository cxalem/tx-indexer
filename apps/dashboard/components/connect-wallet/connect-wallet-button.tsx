"use client";

import {
  useConnectWallet,
  useDisconnectWallet,
  useWallet,
} from "@solana/react-hooks";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { truncate, cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  isMobileDevice,
  isInWalletBrowser,
  hasWalletExtension,
  isPWA,
} from "@/lib/mobile";
import { QrWalletConnect } from "../qr-wallet-connect";
import {
  getStoredSession,
  getStoredKeypair,
  storePendingAuth,
  clearAllMobileWalletData,
} from "@/lib/mobile-wallet/session-storage";
import {
  createEphemeralKeypair,
  buildPhantomConnectUrl,
  buildPhantomSignMessageUrl,
  buildPhantomBrowseUrl,
} from "@/lib/mobile-wallet/phantom-deeplink";
import { storeKeypair } from "@/lib/mobile-wallet/session-storage";
import { ConnectedDropdown } from "./connected-dropdown";
import { WalletOptions } from "./wallet-options";
import { type ConnectionMode, createSignInMessage } from "./constants";

export function ConnectWalletButton() {
  return (
    <Suspense
      fallback={
        <button
          type="button"
          disabled
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-vibrant-red text-white opacity-70 cursor-wait min-w-[160px] justify-center"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>loading...</span>
        </button>
      }
    >
      <ConnectWalletButtonInner />
    </Suspense>
  );
}

function ConnectWalletButtonInner() {
  const wallet = useWallet();
  const connectWallet = useConnectWallet();
  const disconnectWallet = useDisconnectWallet();
  const { isAuthenticated, signIn, signOut } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReAuthenticating, setIsReAuthenticating] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [connectionMode, setConnectionMode] =
    useState<ConnectionMode>("desktop");
  const [dropdownPosition, setDropdownPosition] = useState<"below" | "above">(
    "below",
  );

  const [mobileSession, setMobileSession] = useState<{
    publicKey: string;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pendingSignInRef = useRef(false);
  const processedCallbackRef = useRef(false);

  const isDesktopConnected = wallet.status === "connected";
  const isWalletConnecting = wallet.status === "connecting";
  const isMobileConnected = mobileSession !== null;
  const isConnected = isDesktopConnected || isMobileConnected;

  const address = isDesktopConnected
    ? wallet.session.account.address.toString()
    : isMobileConnected
      ? mobileSession.publicKey
      : null;

  const isSessionExpired = isConnected && !isAuthenticated;
  const hasSignMessageSupport =
    isDesktopConnected && !!wallet.session.signMessage;

  useEffect(() => {
    if (isInWalletBrowser()) {
      setConnectionMode("wallet-browser");
    } else if (isPWA() && isMobileDevice()) {
      setConnectionMode("pwa");
    } else if (isMobileDevice()) {
      setConnectionMode("mobile");
    } else {
      setConnectionMode("desktop");
    }

    const storedSession = getStoredSession();
    if (storedSession) {
      setMobileSession({ publicKey: storedSession.publicKey });
    }
  }, []);

  useEffect(() => {
    if (processedCallbackRef.current) return;

    const walletError = searchParams.get("walletError");
    const mobileConnected = searchParams.get("mobileConnected");
    const mobileSignature = searchParams.get("mobileSignature");
    const authNonce = searchParams.get("authNonce");
    const authMessage = searchParams.get("authMessage");

    if (walletError) {
      processedCallbackRef.current = true;
      setError(decodeURIComponent(walletError));
      setIsConnecting(false);
      router.replace("/", { scroll: false });
      return;
    }

    if (mobileConnected === "true") {
      processedCallbackRef.current = true;
      const storedSession = getStoredSession();
      if (storedSession) {
        setMobileSession({ publicKey: storedSession.publicKey });
      }
      router.replace("/", { scroll: false });
      return;
    }

    if (mobileSignature && authNonce && authMessage) {
      processedCallbackRef.current = true;
      void completeMobileAuth(
        decodeURIComponent(mobileSignature),
        decodeURIComponent(authNonce),
        decodeURIComponent(authMessage),
      );
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router]);

  const startMobileAuth = async (walletAddress: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      const nonceResponse = await fetch("/api/auth/nonce");
      if (!nonceResponse.ok) {
        throw new Error("Failed to get nonce");
      }
      const { nonce } = await nonceResponse.json();

      const message = createSignInMessage(walletAddress, nonce);

      storePendingAuth({ walletAddress, nonce, message });

      const storedSession = getStoredSession();
      const storedKeypair = getStoredKeypair();

      if (!storedSession || !storedKeypair) {
        throw new Error("No session or keypair found");
      }

      const messageBytes = new TextEncoder().encode(message);
      const appUrl = window.location.origin;
      const redirectUrl = `${appUrl}/wallet-callback?type=signMessage`;

      const signUrl = buildPhantomSignMessageUrl({
        message: messageBytes,
        redirectUrl,
        encryptionPublicKey: storedKeypair.publicKey,
        session: storedSession.phantomSession,
        sharedSecret: storedSession.sharedSecret,
      });

      window.location.href = signUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start auth");
      setIsConnecting(false);
    }
  };

  const completeMobileAuth = async (
    signatureB58: string,
    nonce: string,
    message: string,
  ) => {
    setIsConnecting(true);
    setError(null);

    try {
      const storedSession = getStoredSession();
      if (!storedSession) {
        throw new Error("No session found");
      }

      const walletAddress = storedSession.publicKey;

      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          signature: signatureB58,
          message,
          nonce,
        }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || "Failed to verify signature");
      }

      const { token } = await verifyResponse.json();

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { error: signInError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: "magiclink",
      });

      if (signInError) {
        throw signInError;
      }

      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete auth");
    } finally {
      setIsConnecting(false);
    }
  };

  const performDesktopSignIn = useCallback(async () => {
    if (wallet.status !== "connected" || !wallet.session.signMessage) return;

    try {
      const walletAddress = wallet.session.account.address.toString();
      const walletSignMessage = wallet.session.signMessage;
      const signMessage = async (message: Uint8Array) => {
        const result = await walletSignMessage(message);
        return result;
      };

      await signIn(walletAddress, signMessage);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unable to sign in");
    } finally {
      setIsConnecting(false);
      pendingSignInRef.current = false;
    }
  }, [wallet, signIn]);

  const handleReAuthenticate = useCallback(async () => {
    if (isMobileConnected) {
      const storedSession = getStoredSession();
      if (storedSession) {
        void startMobileAuth(storedSession.publicKey);
      }
      return;
    }

    if (isDesktopConnected) {
      if (!wallet.session.signMessage) {
        setError("wallet does not support message signing");
        return;
      }

      setError(null);
      setIsReAuthenticating(true);

      try {
        const walletAddress = wallet.session.account.address.toString();
        const walletSignMessage = wallet.session.signMessage;
        const signMessage = async (message: Uint8Array) => {
          const result = await walletSignMessage(message);
          return result;
        };

        await signIn(walletAddress, signMessage);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "unable to sign in");
      } finally {
        setIsReAuthenticating(false);
      }
    }
  }, [isDesktopConnected, isMobileConnected, wallet, signIn]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!open) return;

      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const focusableElements =
          dropdownRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not([disabled])",
          );
        if (!focusableElements?.length) return;

        const currentIndex = Array.from(focusableElements).findIndex(
          (el) => el === document.activeElement,
        );

        let nextIndex: number;
        if (event.key === "ArrowDown") {
          nextIndex =
            currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex =
            currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
        }

        focusableElements[nextIndex]?.focus();
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!isConnecting) return;

    if (isDesktopConnected && isAuthenticated) {
      setIsConnecting(false);
      pendingSignInRef.current = false;
      return;
    }

    if (
      !isWalletConnecting &&
      !isDesktopConnected &&
      connectionMode !== "mobile"
    ) {
      setIsConnecting(false);
      pendingSignInRef.current = false;
    }
  }, [
    isWalletConnecting,
    isDesktopConnected,
    isConnecting,
    isAuthenticated,
    connectionMode,
  ]);

  useEffect(() => {
    if (!isConnecting) return;

    const timeout = setTimeout(() => {
      setIsConnecting(false);
      pendingSignInRef.current = false;
      setError("Connection timed out. Please try again.");
    }, 30000);

    return () => clearTimeout(timeout);
  }, [isConnecting]);

  useEffect(() => {
    if (isDesktopConnected && pendingSignInRef.current && !isAuthenticated) {
      performDesktopSignIn();
    }
  }, [isDesktopConnected, isAuthenticated, performDesktopSignIn]);

  async function handleDesktopConnect(connectorId: string) {
    setError(null);
    setIsConnecting(true);
    pendingSignInRef.current = true;

    try {
      await connectWallet(connectorId);
    } catch (err: unknown) {
      let errorMessage = "unable to connect";
      if (err instanceof Error && err.message) {
        errorMessage = err.message;
      } else if (
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof err.message === "string"
      ) {
        errorMessage = err.message;
      }

      const isUserRejection =
        errorMessage.toLowerCase().includes("user rejected") ||
        errorMessage.toLowerCase().includes("cancelled");

      if (!isUserRejection) {
        setError(errorMessage);
      }

      setIsConnecting(false);
      pendingSignInRef.current = false;
    }
  }

  function handleMobileConnect(walletId: string) {
    setError(null);
    setIsConnecting(true);
    setOpen(false);

    if (walletId === "phantom") {
      const keypair = createEphemeralKeypair();
      storeKeypair(keypair);

      const appUrl = window.location.origin;
      const redirectUrl = `${appUrl}/wallet-callback?type=connect`;
      const connectUrl = buildPhantomConnectUrl({
        cluster: "mainnet-beta",
        appUrl,
        redirectUrl,
        encryptionPublicKey: keypair.publicKey,
      });

      window.location.href = connectUrl;
    }
  }

  function handleOpenInWallet() {
    const appUrl = window.location.origin;
    const browseUrl = buildPhantomBrowseUrl(appUrl);
    window.location.href = browseUrl;
  }

  async function handleDisconnect() {
    setError(null);
    try {
      if (isAuthenticated) {
        await signOut();
      }

      if (isDesktopConnected) {
        await disconnectWallet();
      }

      if (isMobileConnected) {
        clearAllMobileWalletData();
        setMobileSession(null);
      }

      processedCallbackRef.current = false;
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unable to disconnect");
    }
  }

  const showMobileOptions =
    connectionMode === "mobile" && !hasWalletExtension();
  const showDesktopOptions =
    connectionMode === "desktop" ||
    connectionMode === "wallet-browser" ||
    hasWalletExtension();
  const showPWAOptions = connectionMode === "pwa";

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            if (!open && buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const dropdownHeight = 300;
              setDropdownPosition(
                spaceBelow < dropdownHeight ? "above" : "below",
              );
            }
            setOpen((prev) => !prev);
          }}
          disabled={isConnecting || isWalletConnecting}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={
            address
              ? `Wallet menu for ${truncate(address)}`
              : "Sign in to wallet"
          }
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
            "bg-vibrant-red text-white hover:bg-vibrant-red/90",
            "cursor-pointer min-w-[160px] justify-center",
            (isConnecting || isWalletConnecting) && "opacity-70 cursor-wait",
            isSessionExpired && "ring-2 ring-amber-400 ring-offset-1",
          )}
        >
          {isConnecting || isWalletConnecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>signing in…</span>
            </>
          ) : address ? (
            <div className="flex items-center gap-2">
              {isSessionExpired && (
                <AlertCircle
                  className="h-4 w-4 text-amber-200"
                  aria-hidden="true"
                />
              )}
              <span className="font-mono">{truncate(address)}</span>
            </div>
          ) : (
            <span>sign in</span>
          )}
          {!isConnecting &&
            !isWalletConnecting &&
            (open ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ))}
        </button>

        {open && !isConnecting && !isWalletConnecting && (
          <div
            role="menu"
            aria-orientation="vertical"
            className={cn(
              "absolute right-0 z-50 w-full min-w-[240px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg animate-dropdown-in",
              dropdownPosition === "above"
                ? "bottom-full mb-2"
                : "top-full mt-2",
            )}
          >
            {isConnected ? (
              <ConnectedDropdown
                address={address}
                isAuthenticated={isAuthenticated}
                isSessionExpired={isSessionExpired}
                isReAuthenticating={isReAuthenticating}
                hasSignMessageSupport={hasSignMessageSupport}
                isDesktopConnected={isDesktopConnected}
                onReAuthenticate={() => void handleReAuthenticate()}
                onDisconnect={() => void handleDisconnect()}
              />
            ) : (
              <WalletOptions
                connectionMode={connectionMode}
                showDesktopOptions={showDesktopOptions}
                showMobileOptions={showMobileOptions}
                showPWAOptions={showPWAOptions}
                onDesktopConnect={(id) => void handleDesktopConnect(id)}
                onMobileConnect={handleMobileConnect}
                onOpenInWallet={handleOpenInWallet}
              />
            )}
            {error && (
              <p className="px-3 pb-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <QrWalletConnect
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
      />
    </>
  );
}

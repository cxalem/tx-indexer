"use client";

import {
  useConnectWallet,
  useDisconnectWallet,
  useWallet,
} from "@solana/react-hooks";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { truncate, cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Smartphone,
  QrCode,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  isMobileDevice,
  isInWalletBrowser,
  hasWalletExtension,
} from "@/lib/mobile";
import { QrWalletConnect } from "./qr-wallet-connect";
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

const DESKTOP_CONNECTORS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "wallet-standard:phantom", label: "phantom" },
  { id: "wallet-standard:solflare", label: "solflare" },
  { id: "wallet-standard:backpack", label: "backpack" },
];

const MOBILE_WALLETS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "phantom", label: "phantom" },
];

type ConnectionMode = "desktop" | "mobile" | "wallet-browser";

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

  const [mobileSession, setMobileSession] = useState<{
    publicKey: string;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
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
        void startMobileAuth(storedSession.publicKey);
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

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          disabled={isConnecting || isWalletConnecting}
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
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>signing in...</span>
            </>
          ) : address ? (
            <div className="flex items-center gap-2">
              {isSessionExpired && (
                <AlertCircle className="h-4 w-4 text-amber-200" />
              )}
              <span className="font-mono">{truncate(address)}</span>
            </div>
          ) : (
            <span>sign in</span>
          )}
          {!isConnecting &&
            !isWalletConnecting &&
            (open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            ))}
        </button>

        {open && !isConnecting && !isWalletConnecting && (
          <div className="absolute right-0 z-10 mt-2 w-full min-w-[240px] rounded-lg border border-neutral-200 bg-white shadow-lg animate-dropdown-in">
            {isConnected ? (
              <div className="p-2 space-y-2">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-neutral-500">
                      {isSessionExpired ? "wallet connected" : "signed in"}
                    </p>
                    {isAuthenticated ? (
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        active
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        session expired
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-sm text-neutral-900">
                    {truncate(address ?? "")}
                  </p>
                </div>

                {isSessionExpired && (
                  <button
                    type="button"
                    onClick={() => void handleReAuthenticate()}
                    disabled={
                      isReAuthenticating ||
                      (isDesktopConnected && !hasSignMessageSupport)
                    }
                    className={cn(
                      "w-full px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer",
                      "bg-vibrant-red text-white hover:bg-vibrant-red/90",
                      (isReAuthenticating ||
                        (isDesktopConnected && !hasSignMessageSupport)) &&
                        "opacity-70 cursor-not-allowed",
                    )}
                  >
                    {isReAuthenticating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        signing in...
                      </>
                    ) : isDesktopConnected && !hasSignMessageSupport ? (
                      "wallet doesn't support signing"
                    ) : (
                      "sign in again"
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  sign out
                </button>
              </div>
            ) : (
              <div className="pb-2">
                {showDesktopOptions && (
                  <>
                    <p className="text-xs font-medium text-neutral-500 px-3 py-2">
                      browser wallets
                    </p>
                    <div className="space-y-1">
                      {DESKTOP_CONNECTORS.map((connector) => (
                        <button
                          key={connector.id}
                          type="button"
                          onClick={() =>
                            void handleDesktopConnect(connector.id)
                          }
                          className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors flex justify-between items-center cursor-pointer"
                        >
                          <span>{connector.label}</span>
                          <span className="text-neutral-400">→</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {showMobileOptions && (
                  <>
                    <p className="text-xs font-medium text-neutral-500 px-3 py-2">
                      mobile wallets
                    </p>
                    <div className="space-y-1">
                      {MOBILE_WALLETS.map((mobileWallet) => (
                        <button
                          key={mobileWallet.id}
                          type="button"
                          onClick={() => handleMobileConnect(mobileWallet.id)}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors flex justify-between items-center cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4 text-neutral-400" />
                            <span>{mobileWallet.label}</span>
                          </div>
                          <span className="text-neutral-400">→</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleOpenInWallet}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors flex justify-between items-center cursor-pointer text-neutral-500"
                      >
                        <span>open in wallet browser</span>
                        <span className="text-neutral-400">→</span>
                      </button>
                    </div>
                  </>
                )}

                {connectionMode === "desktop" && (
                  <div className="border-t border-neutral-100 mt-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setShowQrModal(true);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 transition-colors flex justify-between items-center cursor-pointer text-neutral-500"
                    >
                      <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4" />
                        <span>scan with mobile</span>
                      </div>
                      <span className="text-neutral-400">→</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            {error && <p className="px-3 pb-2 text-sm text-red-600">{error}</p>}
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

function createSignInMessage(walletAddress: string, nonce: string): string {
  const domain = typeof window !== "undefined" ? window.location.host : "app";
  const timestamp = new Date().toISOString();

  return `Sign in to ${domain}

Wallet: ${walletAddress}
Nonce: ${nonce}
Issued At: ${timestamp}

This request will not trigger a blockchain transaction or cost any gas fees.`;
}

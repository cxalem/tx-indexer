"use client";

import { useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import bs58 from "bs58";
import {
  isPhantomErrorResponse,
  parsePhantomError,
  parsePhantomConnectCallback,
  parsePhantomSignMessageCallback,
} from "@/lib/mobile-wallet/phantom-deeplink";
import {
  getStoredKeypair,
  getStoredSession,
  storeSession,
  getPendingAuth,
  clearPendingAuth,
} from "@/lib/mobile-wallet/session-storage";
import type { MobileWalletSession } from "@/lib/mobile-wallet/types";

type CallbackType = "connect" | "signMessage";

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        <p className="text-sm text-neutral-500">
          Processing wallet connection...
        </p>
      </div>
    </div>
  );
}

function WalletCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const callbackType = searchParams.get("type") as CallbackType | null;

    if (isPhantomErrorResponse(searchParams)) {
      const error = parsePhantomError(searchParams);
      console.error("[WalletCallback] Phantom error:", error);
      router.replace(`/?walletError=${encodeURIComponent(error.message)}`);
      return;
    }

    const storedKeypair = getStoredKeypair();
    if (!storedKeypair) {
      console.error("[WalletCallback] No keypair found");
      router.replace("/?walletError=No%20keypair%20found");
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
          storeSession(newSession);
          router.replace("/?mobileConnected=true");
          break;
        }
        case "signMessage": {
          const currentSession = getStoredSession();
          if (!currentSession) {
            throw new Error("No session found");
          }
          const signature = parsePhantomSignMessageCallback(
            searchParams,
            currentSession.sharedSecret,
          );

          const pendingAuth = getPendingAuth();
          if (pendingAuth) {
            const signatureB58 = bs58.encode(signature);
            clearPendingAuth();
            router.replace(
              `/?mobileSignature=${encodeURIComponent(signatureB58)}&authNonce=${encodeURIComponent(pendingAuth.nonce)}&authMessage=${encodeURIComponent(pendingAuth.message)}`,
            );
          } else {
            const signatureBase64 = btoa(String.fromCharCode(...signature));
            router.replace(
              `/?signatureResult=${encodeURIComponent(signatureBase64)}`,
            );
          }
          break;
        }
        default:
          router.replace("/?walletError=Unknown%20callback%20type");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Callback processing failed";
      console.error("[WalletCallback] Error:", message);
      router.replace(`/?walletError=${encodeURIComponent(message)}`);
    }
  }, [searchParams, router]);

  return <LoadingFallback />;
}

export default function WalletCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WalletCallbackContent />
    </Suspense>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/react-hooks";
import { useAuth } from "@/lib/auth";

export interface UseReauthReturn {
  /** Whether the user needs to re-authenticate (wallet connected but session expired) */
  needsReauth: boolean;
  /** Whether re-authentication is in progress */
  isReauthenticating: boolean;
  /** Whether the connected wallet supports message signing */
  canReauth: boolean;
  /** Error message if re-authentication failed */
  error: string | null;
  /** Trigger re-authentication flow */
  reauth: () => Promise<boolean>;
  /** Clear any error state */
  clearError: () => void;
}

/**
 * Hook to handle re-authentication when Supabase session expires
 * while wallet remains connected.
 *
 * @example
 * ```tsx
 * const { needsReauth, reauth, isReauthenticating } = useReauth();
 *
 * if (needsReauth) {
 *   return (
 *     <button onClick={reauth} disabled={isReauthenticating}>
 *       Sign in to continue
 *     </button>
 *   );
 * }
 * ```
 */
export function useReauth(): UseReauthReturn {
  const wallet = useWallet();
  const { isAuthenticated, signIn } = useAuth();
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = wallet.status === "connected";
  const hasSignMessageSupport = isConnected && !!wallet.session.signMessage;

  // User needs re-auth if wallet is connected but Supabase session is expired
  const needsReauth = isConnected && !isAuthenticated;

  // Can only re-auth if wallet supports message signing
  const canReauth = hasSignMessageSupport;

  const reauth = useCallback(async (): Promise<boolean> => {
    if (wallet.status !== "connected") {
      setError("Wallet not connected");
      return false;
    }

    if (!wallet.session.signMessage) {
      setError("Wallet does not support message signing");
      return false;
    }

    setError(null);
    setIsReauthenticating(true);

    try {
      const walletAddress = wallet.session.account.address.toString();
      const walletSignMessage = wallet.session.signMessage;
      const signMessage = async (message: Uint8Array) => {
        const result = await walletSignMessage(message);
        return result;
      };

      await signIn(walletAddress, signMessage);
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unable to sign in";
      setError(errorMessage);
      return false;
    } finally {
      setIsReauthenticating(false);
    }
  }, [wallet, signIn]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    needsReauth,
    isReauthenticating,
    canReauth,
    error,
    reauth,
    clearError,
  };
}

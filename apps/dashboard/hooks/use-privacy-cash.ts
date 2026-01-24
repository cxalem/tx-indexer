"use client";

/**
 * Privacy Cash React Hook
 *
 * React hook for Privacy Cash protocol operations.
 * Provides shield (deposit) and unshield (withdraw) functionality with
 * automatic wallet integration and state management.
 *
 * @example
 * ```tsx
 * function PrivacyPanel() {
 *   const {
 *     privateBalance,
 *     status,
 *     isProcessing,
 *     shield,
 *     unshield,
 *     error,
 *   } = usePrivacyCash();
 *
 *   const handleShield = async () => {
 *     const result = await shield({ amount: 1.0, token: "SOL" });
 *     if (result.signature) {
 *       console.log("Shielded successfully:", result.signature);
 *     }
 *   };
 *
 *   const handleUnshield = async () => {
 *     const result = await unshield({
 *       amount: 0.5,
 *       token: "SOL",
 *       recipientAddress: "...",
 *     });
 *     if (result.signature) {
 *       console.log("Unshielded successfully:", result.signature);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <p>Private Balance: {privateBalance?.amount ?? 0} SOL</p>
 *       <button onClick={handleShield} disabled={isProcessing}>
 *         Shield Funds
 *       </button>
 *       {error && <p className="error">{error}</p>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/react-hooks";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  type PrivacyCashToken,
  PRIVACY_CASH_SUPPORTED_TOKENS,
} from "@/lib/privacy/constants";
import {
  PrivacyCashClient,
  type PrivacyBalance,
  type PrivacyCashResult,
} from "@/lib/privacy/privacy-cash-client";
import { detectWalletProvider } from "@/lib/wallet-transactions";

// =============================================================================
// Types
// =============================================================================

/**
 * Operation status for privacy operations.
 * Tracks the lifecycle of shield/unshield operations.
 */
export type PrivacyCashStatus =
  | "idle"
  | "initializing"
  | "loading_balance"
  | "preparing"
  | "generating_proof"
  | "signing"
  | "confirming"
  | "success"
  | "error";

/**
 * Parameters for shielding (depositing) funds.
 */
export interface ShieldParams {
  /** Amount to shield in UI units (e.g., 1.5 for 1.5 SOL) */
  amount: number;
  /** Token to shield */
  token: PrivacyCashToken;
}

/**
 * Parameters for unshielding (withdrawing) funds.
 */
export interface UnshieldParams {
  /** Amount to unshield in UI units */
  amount: number;
  /** Token to unshield */
  token: PrivacyCashToken;
  /** Destination address (can be any Solana address) */
  recipientAddress: string;
}

/**
 * Result of a shield or unshield operation.
 */
export interface PrivacyOperationResult {
  /** Transaction signature (null if failed) */
  signature: string | null;
  /** Error message (null if successful) */
  error: string | null;
  /** Whether the withdrawal was partial (unshield only) */
  isPartial?: boolean;
  /** Fee charged (unshield only, in token units) */
  fee?: number;
}

/**
 * Return type of usePrivacyCash hook.
 */
export interface UsePrivacyCashReturn {
  /** Current private balance (null if not loaded) */
  privateBalance: PrivacyBalance | null;
  /** Whether balance is currently loading */
  isLoadingBalance: boolean;
  /** Current operation status */
  status: PrivacyCashStatus;
  /** Whether an operation is in progress */
  isProcessing: boolean;
  /** Whether the client has been initialized */
  isInitialized: boolean;
  /** Last successful transaction signature */
  signature: string | null;
  /** Last error message */
  error: string | null;
  /** Initialize the privacy client (prompts user to sign) */
  initialize: () => Promise<void>;
  /** Shield funds into the private pool */
  shield: (params: ShieldParams) => Promise<PrivacyOperationResult>;
  /** Unshield funds from the private pool */
  unshield: (params: UnshieldParams) => Promise<PrivacyOperationResult>;
  /** Refresh the private balance */
  refreshBalance: (token?: PrivacyCashToken) => Promise<void>;
  /** Reset state to idle */
  reset: () => void;
  /** Check if a token is supported */
  isTokenSupported: (token: string) => boolean;
}

// =============================================================================
// Constants
// =============================================================================

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * React hook for Privacy Cash operations.
 *
 * This hook manages:
 * - Client lifecycle (creation, initialization)
 * - Operation state (status, errors, signatures)
 * - Wallet adapter bridging (web3.js v2 -> v1)
 *
 * The Privacy Cash SDK is lazy-loaded when first needed.
 *
 * @param defaultToken - Default token for balance queries (default: "SOL")
 * @returns UsePrivacyCashReturn
 */
export function usePrivacyCash(
  defaultToken: PrivacyCashToken = "SOL",
): UsePrivacyCashReturn {
  const wallet = useWallet();

  const clientRef = useRef<PrivacyCashClient | null>(null);
  const connectionRef = useRef<Connection | null>(null);
  const lastAddressRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);
  const isInitializingRef = useRef(false);

  // State
  const [privateBalance, setPrivateBalance] = useState<PrivacyBalance | null>(
    null,
  );
  const [status, setStatus] = useState<PrivacyCashStatus>("idle");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Keep ref in sync with state
  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);

  // Derived wallet state
  const walletAddress =
    wallet.status === "connected"
      ? wallet.session.account.address.toString()
      : null;
  const walletSession = wallet.status === "connected" ? wallet.session : null;

  // ---------------------------------------------------------------------------
  // Connection management
  // ---------------------------------------------------------------------------

  const getConnection = useCallback(() => {
    if (!connectionRef.current) {
      connectionRef.current = new Connection(RPC_URL, "confirmed");
    }
    return connectionRef.current;
  }, []);

  // ---------------------------------------------------------------------------
  // Wallet adapter bridging
  // The dashboard uses @solana/react-hooks (web3.js v2 ecosystem)
  // Privacy Cash SDK uses @solana/web3.js v1
  // We use the wallet provider directly from window for transaction signing
  // ---------------------------------------------------------------------------

  const createSignTransaction = useCallback(() => {
    // Use the wallet provider directly from window (same pattern as wallet-transactions.ts)
    const provider = detectWalletProvider();
    if (!provider?.signTransaction) return null;

    return async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
      console.log("[PrivacyCash] Signing transaction with provider...");
      const signed = await provider.signTransaction!(tx);
      console.log("[PrivacyCash] Transaction signed successfully");
      return signed;
    };
  }, []);

  const createSignMessage = useCallback(() => {
    if (!walletSession?.signMessage) return null;

    const signMsg = walletSession.signMessage;
    return async (message: Uint8Array): Promise<Uint8Array> => {
      return await signMsg(message);
    };
  }, [walletSession]);

  // ---------------------------------------------------------------------------
  // Client management
  // ---------------------------------------------------------------------------

  const getClient = useCallback(() => {
    if (!walletAddress || !walletSession) {
      return null;
    }

    const signTransaction = createSignTransaction();
    const signMessage = createSignMessage();

    if (!signTransaction || !signMessage) {
      return null;
    }

    // Create new client if wallet changed
    if (lastAddressRef.current !== walletAddress) {
      const publicKey = new PublicKey(walletAddress);

      clientRef.current = new PrivacyCashClient({
        connection: getConnection(),
        publicKey,
        signTransaction,
        signMessage,
      });

      lastAddressRef.current = walletAddress;
      setIsInitialized(false);
    }

    return clientRef.current;
  }, [
    walletAddress,
    walletSession,
    createSignTransaction,
    createSignMessage,
    getConnection,
  ]);

  // ---------------------------------------------------------------------------
  // Cleanup on wallet disconnect
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (wallet.status !== "connected") {
      setPrivateBalance(null);
      setIsInitialized(false);
      clientRef.current = null;
      lastAddressRef.current = null;
      isInitializingRef.current = false;
    }
  }, [wallet.status]);

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------

  const initialize = useCallback(async (): Promise<void> => {
    const client = getClient();
    if (!client) {
      setError("Wallet not connected");
      setStatus("error");
      return;
    }

    if (isInitializedRef.current || isInitializingRef.current) return;

    isInitializingRef.current = true;
    setStatus("initializing");
    setError(null);

    try {
      await client.initialize();
      setIsInitialized(true);
      setStatus("idle");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to initialize Privacy Cash";
      setError(errorMessage);
      setStatus("error");
    } finally {
      isInitializingRef.current = false;
    }
  }, [getClient]);

  const refreshBalance = useCallback(
    async (token: PrivacyCashToken = defaultToken): Promise<void> => {
      const client = getClient();
      if (!client) {
        return;
      }

      if (!isInitializedRef.current) {
        if (isInitializingRef.current) {
          return;
        }
        await initialize();
      }

      if (!isInitializedRef.current) {
        return;
      }

      setStatus("loading_balance");
      setError(null);

      try {
        const balance = await client.getBalance(token);
        setPrivateBalance(balance);
        setStatus("idle");
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch balance";
        setError(errorMessage);
        setStatus("error");
      }
    },
    [getClient, initialize, defaultToken],
  );

  const shield = useCallback(
    async (params: ShieldParams): Promise<PrivacyOperationResult> => {
      const { amount, token } = params;
      const client = getClient();

      if (!client) {
        setError("Wallet not connected");
        setStatus("error");
        return { signature: null, error: "Wallet not connected" };
      }

      if (!isInitializedRef.current) {
        if (isInitializingRef.current) {
          return { signature: null, error: "Initialization in progress" };
        }
        try {
          await initialize();
        } catch {
          return { signature: null, error: "Failed to initialize" };
        }
      }

      if (!isInitializedRef.current) {
        return { signature: null, error: "Not initialized" };
      }

      setError(null);
      setSignature(null);
      setStatus("preparing");

      try {
        setStatus("generating_proof");

        const result = await client.deposit(amount, token);

        setSignature(result.signature);
        setStatus("success");

        // Refresh balance in background (non-blocking)
        refreshBalance(token).catch(console.error);

        return { signature: result.signature, error: null };
      } catch (err) {
        console.error("[PrivacyCash] Shield error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Shield failed";
        setError(errorMessage);
        setStatus("error");
        return { signature: null, error: errorMessage };
      }
    },
    [getClient, initialize, refreshBalance],
  );

  const unshield = useCallback(
    async (params: UnshieldParams): Promise<PrivacyOperationResult> => {
      const { amount, token, recipientAddress } = params;
      const client = getClient();

      if (!client) {
        setError("Wallet not connected");
        setStatus("error");
        return { signature: null, error: "Wallet not connected" };
      }

      if (!isInitializedRef.current) {
        if (isInitializingRef.current) {
          return { signature: null, error: "Initialization in progress" };
        }
        try {
          await initialize();
        } catch {
          return { signature: null, error: "Failed to initialize" };
        }
      }

      if (!isInitializedRef.current) {
        return { signature: null, error: "Not initialized" };
      }

      if (privateBalance && privateBalance.amount < amount) {
        setError("Insufficient private balance");
        setStatus("error");
        return { signature: null, error: "Insufficient private balance" };
      }

      setError(null);
      setSignature(null);
      setStatus("preparing");

      try {
        setStatus("generating_proof");

        const result = await client.withdraw(amount, token, recipientAddress);

        setSignature(result.signature);
        setStatus("success");

        // Refresh balance in background (non-blocking)
        refreshBalance(token).catch(console.error);

        return {
          signature: result.signature,
          error: null,
          isPartial: result.isPartial,
          fee: result.fee,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unshield failed";
        setError(errorMessage);
        setStatus("error");
        return { signature: null, error: errorMessage };
      }
    },
    [getClient, initialize, privateBalance, refreshBalance],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setSignature(null);
    setError(null);
  }, []);

  const isTokenSupported = useCallback((token: string): boolean => {
    return token in PRIVACY_CASH_SUPPORTED_TOKENS;
  }, []);

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const isProcessing =
    status === "initializing" ||
    status === "preparing" ||
    status === "generating_proof" ||
    status === "signing" ||
    status === "confirming";

  const isLoadingBalance = status === "loading_balance";

  return {
    privateBalance,
    isLoadingBalance,
    status,
    isProcessing,
    isInitialized,
    signature,
    error,
    initialize,
    shield,
    unshield,
    refreshBalance,
    reset,
    isTokenSupported,
  };
}

// Re-export types for convenience
export type { PrivacyBalance, PrivacyCashResult, PrivacyCashToken };

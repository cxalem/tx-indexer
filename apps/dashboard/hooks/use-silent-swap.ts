"use client";

/**
 * SilentSwap React Hook
 *
 * React hook for SilentSwap SDK integration.
 * Provides private cross-chain swap functionality.
 *
 * =============================================================================
 * HACKATHON: Solana Privacy Hack 2026
 * BOUNTY: SilentSwap - $5,000 (Best projects pool)
 * DOCS: https://docs.silentswap.com/
 * =============================================================================
 *
 * IMPORTANT: SilentSwap requires BOTH an EVM wallet and Solana wallet connected.
 * This hook manages the Solana side; you'll need wagmi or similar for EVM.
 *
 * USAGE:
 * ```tsx
 * const {
 *   quote,
 *   isQuoting,
 *   getQuote,
 *   executeSwap,
 *   status,
 *   error,
 * } = useSilentSwap();
 *
 * // Get quote for private swap
 * await getQuote({
 *   inputToken: "SOL",
 *   outputToken: "USDC",
 *   amount: 1.0,
 * });
 *
 * // Execute the swap
 * await executeSwap();
 * ```
 *
 * =============================================================================
 * IMPLEMENTATION TODOS:
 * =============================================================================
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/react-hooks";
import {
  SILENT_SWAP_ASSETS,
  SILENT_SWAP_SOLANA_CHAIN_ID,
  type SilentSwapEnvironment,
} from "@/lib/privacy/constants";

// =============================================================================
// Types
// =============================================================================

export type SilentSwapStatus =
  | "idle"
  | "quoting"
  | "ready" // Quote received, ready to execute
  | "authenticating" // SIWE authentication
  | "signing"
  | "processing"
  | "success"
  | "error";

export interface SilentSwapQuote {
  /** Quote ID from SilentSwap */
  quoteId: string;
  /** Input amount in smallest units */
  inputAmount: string;
  /** Expected output amount in smallest units */
  outputAmount: string;
  /** Price impact percentage */
  priceImpact?: string;
  /** Quote expiration timestamp */
  expiresAt: number;
  /** Raw quote data for execution */
  rawQuote: unknown;
}

export interface PrivateSwapParams {
  /** Input token symbol or CAIP-19 identifier */
  inputToken: string;
  /** Output token symbol or CAIP-19 identifier */
  outputToken: string;
  /** Amount in UI units */
  amount: number;
  /** Recipient address (defaults to sender) */
  recipientAddress?: string;
}

export interface SilentSwapResult {
  /** Order ID for tracking */
  orderId: string | null;
  /** Transaction signature (if applicable) */
  signature: string | null;
  /** Error message if failed */
  error: string | null;
}

export interface UseSilentSwapReturn {
  /** Current quote (null if none) */
  quote: SilentSwapQuote | null;
  /** Whether currently fetching a quote */
  isQuoting: boolean;
  /** Current operation status */
  status: SilentSwapStatus;
  /** Whether a swap is in progress */
  isSwapping: boolean;
  /** Seconds remaining until quote expires */
  quoteSecondsRemaining: number;
  /** Whether the current quote is expired */
  isQuoteExpired: boolean;
  /** Last order ID */
  orderId: string | null;
  /** Last error message */
  error: string | null;
  /** Get a quote for a private swap */
  getQuote: (params: PrivateSwapParams) => Promise<void>;
  /** Execute swap using current quote */
  executeSwap: () => Promise<SilentSwapResult>;
  /** Refresh the current quote */
  refreshQuote: () => Promise<void>;
  /** Reset state */
  reset: () => void;
  /** Check if EVM wallet is required (always true for SilentSwap) */
  requiresEvmWallet: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Quote validity duration in milliseconds (30 seconds) */
const QUOTE_VALIDITY_MS = 30000;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert token symbol to CAIP-19 asset ID
 */
function tokenToAssetId(token: string): string {
  // If already a CAIP-19 ID, return as-is
  if (token.includes(":")) {
    return token;
  }

  // Convert common symbols
  switch (token.toUpperCase()) {
    case "SOL":
      return SILENT_SWAP_ASSETS.SOL;
    case "USDC":
      return SILENT_SWAP_ASSETS.USDC;
    default:
      // Assume it's a mint address, format as SPL token
      return `${SILENT_SWAP_SOLANA_CHAIN_ID}/erc20:${token}`;
  }
}

/**
 * Format Solana address as CAIP-10 contact ID
 */
function formatSolanaContact(address: string): string {
  return `caip10:solana:*:${address}`;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * React hook for SilentSwap operations
 *
 * @returns UseSilentSwapReturn
 *
 * @example
 * ```tsx
 * function PrivateSwapForm() {
 *   const {
 *     quote,
 *     isQuoting,
 *     getQuote,
 *     executeSwap,
 *     status,
 *     quoteSecondsRemaining,
 *     error,
 *   } = useSilentSwap();
 *
 *   const handleGetQuote = async () => {
 *     await getQuote({
 *       inputToken: "SOL",
 *       outputToken: "USDC",
 *       amount: parseFloat(inputAmount),
 *     });
 *   };
 *
 *   const handleSwap = async () => {
 *     const result = await executeSwap();
 *     if (result.orderId) {
 *       console.log("Swap initiated:", result.orderId);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleGetQuote} disabled={isQuoting}>
 *         {isQuoting ? "Getting quote..." : "Get Quote"}
 *       </button>
 *
 *       {quote && (
 *         <div>
 *           <p>Output: {quote.outputAmount}</p>
 *           <p>Expires in: {quoteSecondsRemaining}s</p>
 *           <button onClick={handleSwap} disabled={status !== "ready"}>
 *             Execute Private Swap
 *           </button>
 *         </div>
 *       )}
 *
 *       {error && <p className="error">{error}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSilentSwap(): UseSilentSwapReturn {
  const wallet = useWallet();

  const [quote, setQuote] = useState<SilentSwapQuote | null>(null);
  const [status, setStatus] = useState<SilentSwapStatus>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteSecondsRemaining, setQuoteSecondsRemaining] = useState(0);

  // Store last quote params for refresh
  const lastQuoteParamsRef = useRef<PrivateSwapParams | null>(null);

  // ===========================================================================
  // TODO 1: Quote expiration countdown
  // ===========================================================================
  useEffect(() => {
    if (!quote) {
      setQuoteSecondsRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.floor((quote.expiresAt - Date.now()) / 1000),
      );
      setQuoteSecondsRemaining(remaining);
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [quote]);

  const isQuoteExpired = quote ? Date.now() >= quote.expiresAt : false;

  // ===========================================================================
  // TODO 2: Implement getQuote
  // ===========================================================================
  const getQuote = useCallback(
    async (params: PrivateSwapParams): Promise<void> => {
      if (wallet.status !== "connected") {
        setError("Wallet not connected");
        setStatus("error");
        return;
      }

      // Store params for refresh
      lastQuoteParamsRef.current = params;

      setError(null);
      setQuote(null);
      setStatus("quoting");

      try {
        const { inputToken, outputToken, amount, recipientAddress } = params;

        // Convert tokens to CAIP-19 format
        const sourceAsset = tokenToAssetId(inputToken);
        const destAsset = tokenToAssetId(outputToken);

        // Get wallet address
        // Note: wallet.session is only available when status === "connected"
        // TypeScript doesn't narrow this automatically, so we cast
        const walletSession = wallet as {
          session: { account: { address: { toString: () => string } } };
        };
        const walletAddress = walletSession.session.account.address.toString();
        const recipient = recipientAddress ?? walletAddress;

        // TODO: Implement using SilentSwap SDK
        //
        // This requires:
        // 1. EVM wallet connection (via wagmi)
        // 2. SIWE authentication
        // 3. Facilitator group creation
        // 4. Quote request
        //
        // const [error, response] = await silentswap.quote({
        //   signer: evmAddress,
        //   viewer: viewerPublicKey,
        //   outputs: [{
        //     method: DeliveryMethod.SNIP,
        //     recipient: formatSolanaContact(recipient),
        //     asset: destAsset,
        //     value: "" as `${bigint}`,
        //     facilitatorPublicKeys: groupPublicKeys[0],
        //   }],
        // });
        //
        // setQuote({
        //   quoteId: response.quoteId,
        //   inputAmount: sourceAmount,
        //   outputAmount: response.outputs[0].value,
        //   expiresAt: Date.now() + QUOTE_VALIDITY_MS,
        //   rawQuote: response,
        // });
        // setStatus("ready");

        throw new Error("Not implemented: SilentSwap SDK integration required");
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to get quote";
        setError(errorMessage);
        setStatus("error");
      }
    },
    [wallet.status],
  );

  // ===========================================================================
  // TODO 3: Implement refreshQuote
  // ===========================================================================
  const refreshQuote = useCallback(async (): Promise<void> => {
    if (!lastQuoteParamsRef.current) return;
    await getQuote(lastQuoteParamsRef.current);
  }, [getQuote]);

  // ===========================================================================
  // TODO 4: Implement executeSwap
  // ===========================================================================
  const executeSwap = useCallback(async (): Promise<SilentSwapResult> => {
    if (wallet.status !== "connected") {
      setError("Wallet not connected");
      setStatus("error");
      return { orderId: null, signature: null, error: "Wallet not connected" };
    }

    if (!quote) {
      setError("No quote available");
      setStatus("error");
      return { orderId: null, signature: null, error: "No quote available" };
    }

    if (isQuoteExpired) {
      setError("Quote expired. Please refresh and try again.");
      setStatus("error");
      return { orderId: null, signature: null, error: "Quote expired" };
    }

    setError(null);
    setOrderId(null);
    setStatus("authenticating");

    try {
      // TODO: Implement using SilentSwap SDK
      //
      // This is a complex multi-step process:
      // 1. Sign the quote with EIP-712 (requires EVM wallet)
      // 2. Get authorizations from facilitators
      // 3. Place the order
      // 4. Monitor for completion
      //
      // See: https://docs.silentswap.com/core/silent-swap/complete-example
      //
      // setStatus("signing");
      // const signedQuote = await signTypedData(...);
      //
      // setStatus("processing");
      // const [orderError, orderResponse] = await silentswap.order({
      //   quote: quote.rawQuote,
      //   quoteId: quote.quoteId,
      //   authorizations: signedAuths,
      //   ...
      // });
      //
      // setOrderId(orderResponse.orderId);
      // setStatus("success");
      //
      // return {
      //   orderId: orderResponse.orderId,
      //   signature: orderResponse.signature,
      //   error: null,
      // };

      throw new Error("Not implemented: SilentSwap SDK integration required");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Swap failed";
      setError(errorMessage);
      setStatus("error");
      return { orderId: null, signature: null, error: errorMessage };
    }
  }, [wallet.status, quote, isQuoteExpired]);

  // ===========================================================================
  // TODO 5: Reset function
  // ===========================================================================
  const reset = useCallback(() => {
    setQuote(null);
    setStatus("idle");
    setOrderId(null);
    setError(null);
    setQuoteSecondsRemaining(0);
    lastQuoteParamsRef.current = null;
  }, []);

  // ===========================================================================
  // Computed values
  // ===========================================================================
  const isQuoting = status === "quoting";
  const isSwapping =
    status === "authenticating" ||
    status === "signing" ||
    status === "processing";

  return {
    quote,
    isQuoting,
    status,
    isSwapping,
    quoteSecondsRemaining,
    isQuoteExpired,
    orderId,
    error,
    getQuote,
    executeSwap,
    refreshQuote,
    reset,
    requiresEvmWallet: true, // SilentSwap always requires EVM wallet
  };
}

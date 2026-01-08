/**
 * Wallet transaction utilities
 * Handles signing and sending versioned transactions across different wallet providers
 */

import { VersionedTransaction, Connection } from "@solana/web3.js";

// RPC URL for sending transactions when wallet doesn't support signAndSend
const getRpcUrl = () =>
  process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com";

export interface WalletProvider {
  signAndSendTransaction?: (
    transaction: VersionedTransaction,
    options?: { commitment?: string },
  ) => Promise<{ signature: string }>;
  signTransaction?: (
    transaction: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
}

/**
 * Detects available wallet provider from window object
 */
export function detectWalletProvider(): WalletProvider | null {
  if (typeof window === "undefined") return null;

  const win = window as unknown as Record<string, unknown>;

  // Check for Phantom
  const phantom = (win.phantom as { solana?: WalletProvider })?.solana;
  if (phantom) {
    return phantom;
  }

  // Check for Solflare
  const solflare = win.solflare as WalletProvider | undefined;
  if (solflare) {
    return solflare;
  }

  // Check for Backpack
  const backpack = (win.backpack as { solana?: WalletProvider })?.solana;
  if (backpack) {
    return backpack;
  }

  // Check for generic solana provider (Brave, etc.)
  const solana = win.solana as WalletProvider | undefined;
  if (solana) {
    return solana;
  }

  return null;
}

/**
 * Signs and sends a versioned transaction using the available wallet
 * Falls back to sign + RPC send if signAndSend is not available
 */
export async function signAndSendTransaction(
  transactionBytes: Uint8Array,
): Promise<string> {
  // Deserialize the transaction
  const transaction = VersionedTransaction.deserialize(transactionBytes);

  // Try to detect wallet provider
  const provider = detectWalletProvider();

  if (!provider) {
    throw new Error(
      "No wallet detected. Please install Phantom, Solflare, or another Solana wallet.",
    );
  }

  // Method 1: Use signAndSendTransaction if available (preferred)
  if (provider.signAndSendTransaction) {
    const result = await provider.signAndSendTransaction(transaction, {
      commitment: "confirmed",
    });
    return result.signature;
  }

  // Method 2: Sign then send via RPC
  if (provider.signTransaction) {
    const signedTransaction = await provider.signTransaction(transaction);
    const connection = new Connection(getRpcUrl(), "confirmed");

    const signature = await connection.sendRawTransaction(
      signedTransaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      },
    );

    return signature;
  }

  throw new Error(
    "Wallet does not support transaction signing. Please use a different wallet.",
  );
}

/**
 * Gets the name of the detected wallet for logging/display
 */
export function getDetectedWalletName(): string | null {
  if (typeof window === "undefined") return null;

  const win = window as unknown as Record<string, unknown>;

  if ((win.phantom as { solana?: unknown })?.solana) return "Phantom";
  if (win.solflare) return "Solflare";
  if ((win.backpack as { solana?: unknown })?.solana) return "Backpack";
  if (win.solana) return "Solana Wallet";

  return null;
}

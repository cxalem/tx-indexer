"use server";

import { createSolanaRpc } from "@solana/kit";
import { address } from "@solana/kit";
import { solanaAddressSchema } from "@/lib/validations";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Fee constants in lamports
const BASE_FEE_LAMPORTS = 5000; // 0.000005 SOL
const TOKEN_ACCOUNT_RENT_LAMPORTS = 2039280; // ~0.00204 SOL for token account rent

// Jupiter API for SOL price
const JUPITER_PRICE_URL = "https://lite-api.jup.ag/price/v3/price";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface FeeEstimate {
  feeSol: number;
  feeUsd: number;
  needsAccountCreation: boolean;
}

/**
 * Fetches the current SOL price in USD from Jupiter API
 */
async function getSolPrice(): Promise<number | null> {
  try {
    const res = await fetch(`${JUPITER_PRICE_URL}?ids=${SOL_MINT}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!res.ok) {
      console.error("[Fee] Failed to fetch SOL price:", res.status);
      return null;
    }

    const data = await res.json();
    return data[SOL_MINT]?.usdPrice ?? null;
  } catch (error) {
    console.error("[Fee] Error fetching SOL price:", error);
    return null;
  }
}

/**
 * Checks if a wallet has an existing USDC token account
 */
async function hasUsdcTokenAccount(walletAddress: string): Promise<boolean> {
  if (!process.env.RPC_URL) {
    throw new Error("RPC_URL environment variable is not set");
  }

  const rpc = createSolanaRpc(process.env.RPC_URL);

  try {
    const response = await rpc
      .getTokenAccountsByOwner(
        address(walletAddress),
        { mint: address(USDC_MINT) },
        { encoding: "jsonParsed" },
      )
      .send();

    return response.value.length > 0;
  } catch (error) {
    console.error("[Fee] Error checking token account:", error);
    // Default to assuming account exists (lower fee estimate)
    return true;
  }
}

/**
 * Estimates the transaction fee for sending USDC to a recipient
 */
export async function estimateFee(
  recipientAddress: string,
): Promise<FeeEstimate> {
  // Validate address format with Zod
  const addressResult = solanaAddressSchema.safeParse(recipientAddress);
  if (!addressResult.success) {
    return {
      feeSol: 0,
      feeUsd: 0,
      needsAccountCreation: false,
    };
  }

  const validAddress = addressResult.data;

  // Check if recipient has USDC account and get SOL price in parallel
  const [hasAccount, solPrice] = await Promise.all([
    hasUsdcTokenAccount(validAddress),
    getSolPrice(),
  ]);

  const needsAccountCreation = !hasAccount;

  // Calculate total fee in lamports
  const totalLamports = needsAccountCreation
    ? BASE_FEE_LAMPORTS + TOKEN_ACCOUNT_RENT_LAMPORTS
    : BASE_FEE_LAMPORTS;

  const feeSol = totalLamports / 1e9;
  const feeUsd = solPrice ? feeSol * solPrice : 0;

  return {
    feeSol,
    feeUsd,
    needsAccountCreation,
  };
}

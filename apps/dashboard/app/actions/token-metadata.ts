"use server";

import type { WalletBalance, TokenAccountBalance } from "tx-indexer/advanced";
import { resolveTokenMetadata, type TokenMetadata } from "@/lib/token-metadata";

/**
 * Extended token balance with full metadata
 */
export interface EnrichedTokenBalance extends TokenAccountBalance {
  name: string;
  logoURI?: string;
  metadataSource: "static" | "jupiter" | "helius" | "fallback";
}

/**
 * Wallet balance with enriched token metadata
 */
export interface EnrichedWalletBalance {
  address: string;
  sol: {
    lamports: bigint;
    ui: number;
  };
  tokens: EnrichedTokenBalance[];
}

/**
 * Enrich a wallet balance with full token metadata.
 *
 * Resolution order:
 * 1. Static registry (known tokens)
 * 2. Jupiter "all" token list
 * 3. Helius DAS API (Metaplex on-chain)
 * 4. Fallback (mint prefix)
 */
export async function enrichWalletBalance(
  balance: WalletBalance,
): Promise<EnrichedWalletBalance> {
  const rpcUrl = process.env.SERVER_RPC_URL;

  // Collect all mints and their decimals
  const mints = balance.tokens.map((t) => t.mint);
  const decimalsMap = new Map<string, number>();
  for (const token of balance.tokens) {
    decimalsMap.set(token.mint, token.decimals);
  }

  // Resolve metadata for all tokens
  const metadataMap = await resolveTokenMetadata(mints, decimalsMap, rpcUrl);

  // Enrich tokens with metadata
  const enrichedTokens: EnrichedTokenBalance[] = balance.tokens.map((token) => {
    const metadata = metadataMap.get(token.mint);

    return {
      ...token,
      // Override symbol if we have better metadata
      symbol: metadata?.symbol ?? token.symbol,
      name: metadata?.name ?? token.symbol,
      logoURI: metadata?.logoURI,
      metadataSource: metadata?.source ?? "fallback",
    };
  });

  return {
    address: balance.address,
    sol: balance.sol,
    tokens: enrichedTokens,
  };
}

/**
 * Get metadata for specific token mints.
 * Useful for one-off lookups in UI components.
 */
export async function getTokenMetadataBatch(
  mints: string[],
): Promise<Map<string, TokenMetadata>> {
  const rpcUrl = process.env.SERVER_RPC_URL;
  return resolveTokenMetadata(mints, undefined, rpcUrl);
}

/**
 * Token metadata resolver for the dashboard.
 *
 * Resolution order:
 * 1. Static registry (KNOWN_TOKENS from tx-indexer)
 * 2. Jupiter "all" token list (broad coverage)
 * 3. Helius DAS API (Metaplex on-chain metadata)
 * 4. Fallback: mint prefix + decimals
 *
 * Results are cached in-memory for performance.
 */

import { getTokenInfo, TOKEN_INFO } from "tx-indexer";

// Types
export interface TokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  source: "static" | "jupiter" | "helius" | "fallback";
}

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface HeliusDasAsset {
  id: string;
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
    };
    links?: {
      image?: string;
    };
    files?: Array<{
      uri?: string;
      cdn_uri?: string;
    }>;
  };
  token_info?: {
    decimals?: number;
    symbol?: string;
  };
}

// In-memory caches
const jupiterCache = new Map<string, TokenMetadata>();
const heliusCache = new Map<string, TokenMetadata>();
let jupiterListLoaded = false;
let jupiterLoadPromise: Promise<void> | null = null;
// Jupiter token list - cached endpoint (no auth required, includes all tokens)
const JUPITER_ALL_URL = "https://cache.jup.ag/tokens";
const JUPITER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
let jupiterLastFetch = 0;

/**
 * Load the full Jupiter token list (all tokens, not just verified)
 */
async function loadJupiterTokenList(): Promise<void> {
  if (jupiterLoadPromise) {
    return jupiterLoadPromise;
  }

  const now = Date.now();
  if (jupiterListLoaded && now - jupiterLastFetch < JUPITER_CACHE_TTL) {
    return;
  }

  jupiterLoadPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(JUPITER_ALL_URL, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[TokenMetadata] Jupiter API returned ${response.status}`);
        return;
      }

      const tokens = (await response.json()) as JupiterToken[];

      // Clear and repopulate cache
      jupiterCache.clear();
      for (const token of tokens) {
        jupiterCache.set(token.address, {
          mint: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
          source: "jupiter",
        });
      }

      jupiterListLoaded = true;
      jupiterLastFetch = Date.now();
      console.log(
        `[TokenMetadata] Loaded ${tokens.length} tokens from Jupiter`,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn("[TokenMetadata] Jupiter fetch timed out");
      } else {
        console.warn("[TokenMetadata] Failed to load Jupiter tokens:", error);
      }
    } finally {
      jupiterLoadPromise = null;
    }
  })();

  return jupiterLoadPromise;
}

/**
 * Fetch token metadata from Helius DAS API (Metaplex on-chain metadata)
 */
async function fetchHeliusMetadata(
  mints: string[],
  rpcUrl: string,
): Promise<Map<string, TokenMetadata>> {
  const results = new Map<string, TokenMetadata>();

  if (mints.length === 0) {
    return results;
  }

  try {
    // Use getAssetBatch for efficiency
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "get-asset-batch",
        method: "getAssetBatch",
        params: {
          ids: mints,
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[TokenMetadata] Helius DAS returned ${response.status}`);
      return results;
    }

    const data = await response.json();

    if (data.error) {
      console.warn("[TokenMetadata] Helius DAS error:", data.error);
      return results;
    }

    const assets = (data.result || []) as HeliusDasAsset[];

    for (const asset of assets) {
      if (!asset || !asset.id) continue;

      const metadata = asset.content?.metadata;
      const tokenInfo = asset.token_info;
      const links = asset.content?.links;
      const files = asset.content?.files;

      // Get the best available image
      const logoURI =
        links?.image || files?.[0]?.cdn_uri || files?.[0]?.uri || undefined;

      // Get symbol (prefer token_info over metadata)
      const symbol =
        tokenInfo?.symbol || metadata?.symbol || asset.id.slice(0, 6);

      // Get name
      const name = metadata?.name || `Token ${asset.id.slice(0, 8)}...`;

      // Get decimals
      const decimals = tokenInfo?.decimals ?? 9;

      const tokenMetadata: TokenMetadata = {
        mint: asset.id,
        symbol,
        name,
        decimals,
        logoURI,
        source: "helius",
      };

      results.set(asset.id, tokenMetadata);
      heliusCache.set(asset.id, tokenMetadata);
    }

    console.log(
      `[TokenMetadata] Resolved ${results.size}/${mints.length} tokens from Helius DAS`,
    );
  } catch (error) {
    console.warn("[TokenMetadata] Helius DAS fetch failed:", error);
  }

  return results;
}

/**
 * Create a fallback token metadata entry
 */
function createFallbackMetadata(
  mint: string,
  decimals: number = 9,
): TokenMetadata {
  return {
    mint,
    symbol: mint.slice(0, 6),
    name: `Unknown Token (${mint.slice(0, 8)}...)`,
    decimals,
    source: "fallback",
  };
}

/**
 * Resolve token metadata for multiple mints.
 *
 * @param mints - Array of token mint addresses
 * @param decimalsMap - Optional map of mint -> decimals (from balance data)
 * @param rpcUrl - Helius RPC URL for DAS fallback
 * @returns Map of mint -> TokenMetadata
 */
export async function resolveTokenMetadata(
  mints: string[],
  decimalsMap?: Map<string, number>,
  rpcUrl?: string,
): Promise<Map<string, TokenMetadata>> {
  const results = new Map<string, TokenMetadata>();
  const missingAfterStatic: string[] = [];
  const missingAfterJupiter: string[] = [];

  // 1. Check static registry first
  for (const mint of mints) {
    const staticInfo = TOKEN_INFO[mint];
    if (staticInfo) {
      results.set(mint, {
        mint,
        symbol: staticInfo.symbol,
        name: staticInfo.name ?? staticInfo.symbol,
        decimals: staticInfo.decimals,
        logoURI: staticInfo.logoURI,
        source: "static",
      });
    } else {
      missingAfterStatic.push(mint);
    }
  }

  if (missingAfterStatic.length === 0) {
    return results;
  }

  // 2. Load and check Jupiter cache
  await loadJupiterTokenList();

  for (const mint of missingAfterStatic) {
    const jupiterInfo = jupiterCache.get(mint);
    if (jupiterInfo) {
      results.set(mint, jupiterInfo);
    } else {
      // Also check helius cache before marking as missing
      const heliusInfo = heliusCache.get(mint);
      if (heliusInfo) {
        results.set(mint, heliusInfo);
      } else {
        missingAfterJupiter.push(mint);
      }
    }
  }

  if (missingAfterJupiter.length === 0) {
    return results;
  }

  // 3. Fetch from Helius DAS for remaining mints
  if (rpcUrl && missingAfterJupiter.length > 0) {
    const heliusResults = await fetchHeliusMetadata(
      missingAfterJupiter,
      rpcUrl,
    );

    for (const [mint, metadata] of heliusResults) {
      results.set(mint, metadata);
    }
  }

  // 4. Create fallbacks for any still-missing mints
  for (const mint of missingAfterJupiter) {
    if (!results.has(mint)) {
      const decimals = decimalsMap?.get(mint) ?? 9;
      results.set(mint, createFallbackMetadata(mint, decimals));
    }
  }

  return results;
}

/**
 * Get token metadata for a single mint (convenience wrapper)
 */
export async function getTokenMetadata(
  mint: string,
  decimals?: number,
  rpcUrl?: string,
): Promise<TokenMetadata> {
  const decimalsMap =
    decimals !== undefined ? new Map([[mint, decimals]]) : undefined;
  const results = await resolveTokenMetadata([mint], decimalsMap, rpcUrl);
  return results.get(mint) || createFallbackMetadata(mint, decimals);
}

/**
 * Pre-warm the Jupiter cache (call on server startup)
 */
export async function warmJupiterCache(): Promise<void> {
  await loadJupiterTokenList();
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): {
  jupiterCacheSize: number;
  heliusCacheSize: number;
  jupiterLoaded: boolean;
} {
  return {
    jupiterCacheSize: jupiterCache.size,
    heliusCacheSize: heliusCache.size,
    jupiterLoaded: jupiterListLoaded,
  };
}

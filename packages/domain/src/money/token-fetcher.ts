import type { TokenInfo } from "./money.types";
import { TOKEN_INFO, createUnknownToken } from "./token-registry";

/**
 * Jupiter Token API response format
 */
interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  daily_volume?: number;
}

/**
 * Options for the token fetcher
 */
export interface TokenFetcherOptions {
  /**
   * Jupiter API endpoint. Defaults to the strict list (verified tokens).
   * Use "https://tokens.jup.ag/tokens?tags=verified" for verified tokens
   * Use "https://tokens.jup.ag/tokens" for all tokens
   */
  jupiterApiUrl?: string;

  /**
   * Time-to-live for cached tokens in milliseconds.
   * Defaults to 5 minutes.
   */
  cacheTtlMs?: number;

  /**
   * Whether to fetch all tokens on initialization.
   * If false, tokens will be fetched on-demand.
   * Defaults to false.
   */
  prefetch?: boolean;
}

const DEFAULT_JUPITER_API_URL = "https://tokens.jup.ag/tokens?tags=verified";
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches and caches token metadata from Jupiter's token API.
 *
 * Usage:
 * ```ts
 * const fetcher = createTokenFetcher();
 * const token = await fetcher.getToken("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
 * ```
 */
export interface TokenFetcher {
  /**
   * Get token info for a single mint address.
   * Returns from cache if available, otherwise fetches from Jupiter.
   * Falls back to static registry, then creates unknown token placeholder.
   */
  getToken(mint: string, decimals?: number): Promise<TokenInfo>;

  /**
   * Get token info for multiple mint addresses.
   * More efficient than calling getToken multiple times.
   */
  getTokens(
    mints: string[],
    defaultDecimals?: number,
  ): Promise<Map<string, TokenInfo>>;

  /**
   * Force refresh the token cache from Jupiter API.
   */
  refresh(): Promise<void>;

  /**
   * Get the number of tokens currently cached.
   */
  getCacheSize(): number;
}

/**
 * Creates a new token fetcher instance.
 */
export function createTokenFetcher(
  options: TokenFetcherOptions = {},
): TokenFetcher {
  const {
    jupiterApiUrl = DEFAULT_JUPITER_API_URL,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    prefetch = false,
  } = options;

  // In-memory cache for Jupiter tokens
  const jupiterCache = new Map<string, TokenInfo>();
  let lastFetchTime = 0;
  let fetchPromise: Promise<void> | null = null;

  /**
   * Fetches all tokens from Jupiter API and populates the cache.
   */
  async function fetchJupiterTokens(): Promise<void> {
    // If already fetching, wait for that to complete
    if (fetchPromise) {
      return fetchPromise;
    }

    // If cache is still fresh, skip
    if (Date.now() - lastFetchTime < cacheTtlMs && jupiterCache.size > 0) {
      return;
    }

    fetchPromise = (async () => {
      try {
        const response = await fetch(jupiterApiUrl);

        if (!response.ok) {
          console.warn(
            `Jupiter API returned ${response.status}: ${response.statusText}`,
          );
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
          });
        }

        lastFetchTime = Date.now();
      } catch (error) {
        console.warn("Failed to fetch Jupiter tokens:", error);
        // Keep existing cache on error
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  }

  /**
   * Gets token info with fallback chain:
   * 1. Static registry (instant, always available)
   * 2. Jupiter cache (if populated)
   * 3. Jupiter API fetch (if cache miss and needed)
   * 4. Unknown token placeholder (last resort)
   */
  async function getToken(mint: string, decimals = 9): Promise<TokenInfo> {
    // 1. Check static registry first (most common tokens, always available)
    const staticToken = TOKEN_INFO[mint];
    if (staticToken) {
      return staticToken;
    }

    // 2. Check Jupiter cache
    const cachedToken = jupiterCache.get(mint);
    if (cachedToken) {
      return cachedToken;
    }

    // 3. Try to fetch from Jupiter if cache is empty or stale
    await fetchJupiterTokens();

    // 4. Check cache again after fetch
    const fetchedToken = jupiterCache.get(mint);
    if (fetchedToken) {
      return fetchedToken;
    }

    // 5. Return unknown token placeholder
    return createUnknownToken(mint, decimals);
  }

  /**
   * Gets multiple tokens efficiently.
   */
  async function getTokens(
    mints: string[],
    defaultDecimals = 9,
  ): Promise<Map<string, TokenInfo>> {
    const result = new Map<string, TokenInfo>();
    const missingMints: string[] = [];

    // First pass: check static registry and cache
    for (const mint of mints) {
      const staticToken = TOKEN_INFO[mint];
      if (staticToken) {
        result.set(mint, staticToken);
        continue;
      }

      const cachedToken = jupiterCache.get(mint);
      if (cachedToken) {
        result.set(mint, cachedToken);
        continue;
      }

      missingMints.push(mint);
    }

    // If we have missing tokens, try to fetch from Jupiter
    if (missingMints.length > 0) {
      await fetchJupiterTokens();

      // Second pass for missing tokens
      for (const mint of missingMints) {
        const fetchedToken = jupiterCache.get(mint);
        if (fetchedToken) {
          result.set(mint, fetchedToken);
        } else {
          result.set(mint, createUnknownToken(mint, defaultDecimals));
        }
      }
    }

    return result;
  }

  async function refresh(): Promise<void> {
    lastFetchTime = 0; // Force refresh
    await fetchJupiterTokens();
  }

  function getCacheSize(): number {
    return jupiterCache.size;
  }

  // Prefetch if requested
  if (prefetch) {
    fetchJupiterTokens().catch(() => {
      // Ignore prefetch errors
    });
  }

  return {
    getToken,
    getTokens,
    refresh,
    getCacheSize,
  };
}

/**
 * Singleton instance for convenience.
 * Use createTokenFetcher() if you need custom options.
 */
let defaultFetcher: TokenFetcher | null = null;

export function getDefaultTokenFetcher(): TokenFetcher {
  if (!defaultFetcher) {
    defaultFetcher = createTokenFetcher();
  }
  return defaultFetcher;
}

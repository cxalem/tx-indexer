/**
 * Token Account (ATA) List Cache
 *
 * Caches the list of Associated Token Accounts (ATAs) for a wallet.
 * ATAs rarely change, so we can cache aggressively with a long TTL.
 *
 * Features:
 * - 12 hour default TTL
 * - Smart invalidation when new ATAs are detected from transactions
 * - Reduces RPC calls to getTokenAccountsByOwner
 */

import { getRedis, isRedisConfigured } from "@/lib/redis";
import { trackCacheHit, trackCacheMiss, trackApiCall } from "@/lib/performance";

// =============================================================================
// Configuration
// =============================================================================

// 12 hours TTL - ATAs rarely change
const TOKEN_ACCOUNT_CACHE_TTL_SECONDS = 12 * 60 * 60;

// Redis key prefix for token account cache
const ATA_CACHE_PREFIX = "ata:";

// =============================================================================
// Types
// =============================================================================

interface CachedTokenAccountData {
  /** List of token account addresses */
  accounts: string[];
  /** Timestamp when cached */
  timestamp: number;
}

// =============================================================================
// Cache Key Helpers
// =============================================================================

/**
 * Generate Redis key for a wallet's token account list
 */
function getCacheKey(walletAddress: string): string {
  return `${ATA_CACHE_PREFIX}${walletAddress}`;
}

// =============================================================================
// Cache Operations
// =============================================================================

/**
 * Get cached token accounts for a wallet
 */
export async function getCachedTokenAccounts(
  walletAddress: string,
): Promise<string[] | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const redis = getRedis();
  if (!redis) {
    return null;
  }

  const startTime = performance.now();

  try {
    const cachedString = await redis.get<string>(getCacheKey(walletAddress));
    const duration = performance.now() - startTime;

    if (!cachedString) {
      trackCacheMiss(`redis:ata:${walletAddress.slice(0, 8)}`);
      trackApiCall("redis-ata-get", duration, { cached: false });
      return null;
    }

    const cached: CachedTokenAccountData =
      typeof cachedString === "string"
        ? JSON.parse(cachedString)
        : cachedString;

    trackCacheHit(`redis:ata:${walletAddress.slice(0, 8)}`);
    trackApiCall("redis-ata-get", duration, { cached: true });

    console.log(
      `[ATA Cache] HIT for ${walletAddress.slice(0, 8)}... - ${cached.accounts.length} accounts`,
    );

    return cached.accounts;
  } catch (error) {
    console.error("[ATA Cache] Failed to get from Redis:", error);
    trackCacheMiss(`redis:ata:${walletAddress.slice(0, 8)}:error`);
    return null;
  }
}

/**
 * Store token accounts in cache
 */
export async function setCachedTokenAccounts(
  walletAddress: string,
  accounts: string[],
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  const redis = getRedis();
  if (!redis) {
    return;
  }

  const startTime = performance.now();

  try {
    const cacheData: CachedTokenAccountData = {
      accounts,
      timestamp: Date.now(),
    };

    await redis.set(getCacheKey(walletAddress), JSON.stringify(cacheData), {
      ex: TOKEN_ACCOUNT_CACHE_TTL_SECONDS,
    });

    const duration = performance.now() - startTime;
    trackApiCall("redis-ata-set", duration, { cached: false });

    console.log(
      `[ATA Cache] SET for ${walletAddress.slice(0, 8)}... - ${accounts.length} accounts`,
    );
  } catch (error) {
    console.error("[ATA Cache] Failed to set in Redis:", error);
  }
}

/**
 * Invalidate (delete) the token account cache for a wallet.
 * Call this when a new ATA is detected for the wallet.
 */
export async function invalidateTokenAccountCache(
  walletAddress: string,
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  const redis = getRedis();
  if (!redis) {
    return;
  }

  try {
    await redis.del(getCacheKey(walletAddress));
    console.log(
      `[ATA Cache] INVALIDATED for ${walletAddress.slice(0, 8)}... (new ATA detected)`,
    );
  } catch (error) {
    console.error("[ATA Cache] Failed to invalidate:", error);
  }
}

/**
 * Add new token accounts to an existing cache entry.
 * Use this when new ATAs are detected but you want to update rather than invalidate.
 */
export async function addToTokenAccountCache(
  walletAddress: string,
  newAccounts: string[],
): Promise<void> {
  if (!isRedisConfigured() || newAccounts.length === 0) {
    return;
  }

  const redis = getRedis();
  if (!redis) {
    return;
  }

  try {
    const existing = await getCachedTokenAccounts(walletAddress);
    if (!existing) {
      // No existing cache, just set the new accounts
      await setCachedTokenAccounts(walletAddress, newAccounts);
      return;
    }

    // Merge and dedupe
    const existingSet = new Set(existing);
    const merged = [...existing];
    for (const account of newAccounts) {
      if (!existingSet.has(account)) {
        merged.push(account);
      }
    }

    await setCachedTokenAccounts(walletAddress, merged);
    console.log(
      `[ATA Cache] UPDATED for ${walletAddress.slice(0, 8)}... - added ${newAccounts.length} new accounts`,
    );
  } catch (error) {
    console.error("[ATA Cache] Failed to add accounts:", error);
  }
}

// =============================================================================
// Cache Stats & Management
// =============================================================================

/**
 * Get cache stats for debugging
 */
export async function getTokenAccountCacheStats(): Promise<{
  configured: boolean;
  keyCount: number;
  sampleKeys: string[];
} | null> {
  if (!isRedisConfigured()) {
    return { configured: false, keyCount: 0, sampleKeys: [] };
  }

  const redis = getRedis();
  if (!redis) {
    return { configured: false, keyCount: 0, sampleKeys: [] };
  }

  try {
    const keys: string[] = [];
    let cursor: string = "0";
    let totalCount = 0;

    do {
      const result = await redis.scan(cursor, {
        match: `${ATA_CACHE_PREFIX}*`,
        count: 100,
      });
      cursor = String(result[0]);
      totalCount += result[1].length;

      if (keys.length < 10) {
        keys.push(
          ...result[1]
            .slice(0, 10 - keys.length)
            .map((k) => k.replace(ATA_CACHE_PREFIX, "")),
        );
      }

      if (totalCount > 1000) break;
    } while (cursor !== "0");

    return {
      configured: true,
      keyCount: totalCount,
      sampleKeys: keys,
    };
  } catch (error) {
    console.error("[ATA Cache] Failed to get stats:", error);
    return null;
  }
}

/**
 * Clear all token account caches (use with caution - mainly for testing)
 */
export async function clearAllTokenAccountCaches(): Promise<number> {
  if (!isRedisConfigured()) {
    return 0;
  }

  const redis = getRedis();
  if (!redis) {
    return 0;
  }

  try {
    let deletedCount = 0;
    let cursor: string = "0";

    do {
      const result = await redis.scan(cursor, {
        match: `${ATA_CACHE_PREFIX}*`,
        count: 100,
      });
      cursor = String(result[0]);
      const keys = result[1];

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    return deletedCount;
  } catch (error) {
    console.error("[ATA Cache] Failed to clear all caches:", error);
    return 0;
  }
}

/**
 * Signature-level Redis cache for classified transactions
 *
 * Unlike the wallet-level transaction cache, this caches individual transactions
 * by their signature. Since signatures are immutable and classification is
 * deterministic, we can cache aggressively with a long TTL.
 *
 * Benefits:
 * - Avoids redundant RPC calls for the same signature across different wallets
 * - Avoids re-classification of already-processed transactions
 * - Shared across all users and serverless instances
 * - 24h TTL (signatures never change once confirmed)
 */

import { getRedis, isRedisConfigured } from "@/lib/redis";
import type { ClassifiedTransaction } from "tx-indexer";
import { trackCacheHit, trackCacheMiss, trackApiCall } from "@/lib/performance";

// =============================================================================
// BigInt Serialization Helpers
// =============================================================================

/**
 * Replacer function for JSON.stringify that converts BigInt to string
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return { __type: "bigint", value: value.toString() };
  }
  return value;
}

/**
 * Reviver function for JSON.parse that converts string back to BigInt
 */
function bigIntReviver(_key: string, value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    (value as Record<string, unknown>).__type === "bigint"
  ) {
    return BigInt((value as { value: string }).value);
  }
  return value;
}

/**
 * Serialize data for Redis storage (handles BigInt)
 */
function serialize<T>(data: T): string {
  return JSON.stringify(data, bigIntReplacer);
}

/**
 * Deserialize data from Redis storage (handles BigInt)
 */
function deserialize<T>(data: string): T {
  return JSON.parse(data, bigIntReviver) as T;
}

// =============================================================================
// Configuration
// =============================================================================

// 24 hours TTL - signatures are immutable once confirmed
const SIGNATURE_CACHE_TTL_SECONDS = 24 * 60 * 60;

// Redis key prefix for signature cache
const SIG_CACHE_PREFIX = "sig:";

// Maximum number of signatures to batch in a single mget/mset operation
const MAX_BATCH_SIZE = 100;

// =============================================================================
// Cache Key Helpers
// =============================================================================

/**
 * Generate Redis key for a signature
 */
function getCacheKey(signature: string): string {
  return `${SIG_CACHE_PREFIX}${signature}`;
}

// =============================================================================
// Single Signature Operations
// =============================================================================

/**
 * Get a single cached transaction by signature
 */
export async function getCachedSignature(
  signature: string,
): Promise<ClassifiedTransaction | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const redis = getRedis();
  if (!redis) {
    return null;
  }

  const startTime = performance.now();

  try {
    const cachedString = await redis.get<string>(getCacheKey(signature));
    const duration = performance.now() - startTime;

    if (!cachedString) {
      trackCacheMiss(`redis:sig:${signature.slice(0, 8)}`);
      trackApiCall("redis-sig-get", duration, { cached: false });
      return null;
    }

    const cached = deserialize<ClassifiedTransaction>(
      typeof cachedString === "string"
        ? cachedString
        : JSON.stringify(cachedString),
    );

    trackCacheHit(`redis:sig:${signature.slice(0, 8)}`);
    trackApiCall("redis-sig-get", duration, { cached: true });

    return cached;
  } catch (error) {
    console.error("[Sig Cache] Failed to get from Redis:", error);
    trackCacheMiss(`redis:sig:${signature.slice(0, 8)}:error`);
    return null;
  }
}

/**
 * Store a single classified transaction by signature
 */
export async function setCachedSignature(
  tx: ClassifiedTransaction,
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
    const signature = tx.tx.signature;
    const serialized = serialize(tx);

    await redis.set(getCacheKey(signature), serialized, {
      ex: SIGNATURE_CACHE_TTL_SECONDS,
    });

    const duration = performance.now() - startTime;
    trackApiCall("redis-sig-set", duration, { cached: false });
  } catch (error) {
    console.error("[Sig Cache] Failed to set in Redis:", error);
  }
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Result of a batch signature lookup
 */
export interface BatchSignatureLookupResult {
  /** Cached transactions found (keyed by signature) */
  cached: Map<string, ClassifiedTransaction>;
  /** Signatures that were not found in cache */
  missing: string[];
}

/**
 * Get multiple cached transactions by signature in a single batch operation
 *
 * @param signatures - Array of signatures to look up
 * @returns Object containing cached transactions and missing signatures
 */
export async function getCachedSignatures(
  signatures: string[],
): Promise<BatchSignatureLookupResult> {
  const result: BatchSignatureLookupResult = {
    cached: new Map(),
    missing: [],
  };

  if (signatures.length === 0) {
    return result;
  }

  if (!isRedisConfigured()) {
    result.missing = signatures;
    return result;
  }

  const redis = getRedis();
  if (!redis) {
    result.missing = signatures;
    return result;
  }

  const startTime = performance.now();

  try {
    // Process in batches to avoid overwhelming Redis
    for (let i = 0; i < signatures.length; i += MAX_BATCH_SIZE) {
      const batch = signatures.slice(i, i + MAX_BATCH_SIZE);
      const keys = batch.map(getCacheKey);

      // Use mget for batch retrieval
      const values = await redis.mget<(string | null)[]>(...keys);

      for (let j = 0; j < batch.length; j++) {
        const sig = batch[j];
        const value = values[j];

        if (sig === undefined) continue;

        if (value) {
          const tx = deserialize<ClassifiedTransaction>(
            typeof value === "string" ? value : JSON.stringify(value),
          );
          result.cached.set(sig, tx);
          trackCacheHit(`redis:sig:${sig.slice(0, 8)}`);
        } else {
          result.missing.push(sig);
          trackCacheMiss(`redis:sig:${sig.slice(0, 8)}`);
        }
      }
    }

    const duration = performance.now() - startTime;
    trackApiCall("redis-sig-mget", duration, {
      cached: result.cached.size > 0,
    });

    return result;
  } catch (error) {
    console.error("[Sig Cache] Failed to batch get from Redis:", error);
    // On error, return all as missing so they get fetched
    result.missing = signatures.filter((sig) => !result.cached.has(sig));
    return result;
  }
}

/**
 * Store multiple classified transactions by signature in a batch operation
 *
 * @param transactions - Array of classified transactions to cache
 */
export async function setCachedSignatures(
  transactions: ClassifiedTransaction[],
): Promise<void> {
  if (transactions.length === 0 || !isRedisConfigured()) {
    return;
  }

  const redis = getRedis();
  if (!redis) {
    return;
  }

  const startTime = performance.now();

  try {
    // Process in batches
    for (let i = 0; i < transactions.length; i += MAX_BATCH_SIZE) {
      const batch = transactions.slice(i, i + MAX_BATCH_SIZE);

      // Use pipeline for batch set operations
      const pipeline = redis.pipeline();

      for (const tx of batch) {
        const key = getCacheKey(tx.tx.signature);
        const serialized = serialize(tx);
        pipeline.set(key, serialized, { ex: SIGNATURE_CACHE_TTL_SECONDS });
      }

      await pipeline.exec();
    }

    const duration = performance.now() - startTime;
    trackApiCall("redis-sig-mset", duration, { cached: false });
  } catch (error) {
    console.error("[Sig Cache] Failed to batch set in Redis:", error);
  }
}

// =============================================================================
// Cache Stats & Management
// =============================================================================

/**
 * Get cache stats for debugging
 */
export async function getSignatureCacheStats(): Promise<{
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

    // Only scan a limited number to get a count estimate
    do {
      const result = await redis.scan(cursor, {
        match: `${SIG_CACHE_PREFIX}*`,
        count: 100,
      });
      cursor = String(result[0]);
      totalCount += result[1].length;

      // Keep only first 10 as samples
      if (keys.length < 10) {
        keys.push(
          ...result[1]
            .slice(0, 10 - keys.length)
            .map((k) => k.replace(SIG_CACHE_PREFIX, "")),
        );
      }

      // Stop after scanning a reasonable amount for stats
      if (totalCount > 1000) break;
    } while (cursor !== "0");

    return {
      configured: true,
      keyCount: totalCount,
      sampleKeys: keys,
    };
  } catch (error) {
    console.error("[Sig Cache] Failed to get stats:", error);
    return null;
  }
}

/**
 * Clear all signature caches (use with caution - mainly for testing)
 */
export async function clearAllSignatureCaches(): Promise<number> {
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
        match: `${SIG_CACHE_PREFIX}*`,
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
    console.error("[Sig Cache] Failed to clear all caches:", error);
    return 0;
  }
}

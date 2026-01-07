import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Initialize Redis client
// Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limiter for auth endpoints
// 10 requests per 60 seconds per IP
export const authRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  analytics: true,
  prefix: "ratelimit:auth",
});

// Nonce storage keys
const NONCE_PREFIX = "auth:nonce:";
const NONCE_TTL_SECONDS = 300; // 5 minutes

/**
 * Stores a nonce in Redis with expiration
 */
export async function storeNonce(nonce: string): Promise<void> {
  await redis.set(`${NONCE_PREFIX}${nonce}`, "1", { ex: NONCE_TTL_SECONDS });
}

/**
 * Validates and consumes a nonce (single use)
 * Returns true if nonce was valid and unused, false otherwise
 */
export async function validateAndConsumeNonce(nonce: string): Promise<boolean> {
  // Use GETDEL to atomically get and delete the nonce
  // This ensures the nonce can only be used once
  const result = await redis.getdel(`${NONCE_PREFIX}${nonce}`);
  return result !== null;
}

/**
 * Checks if Redis is configured and available
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

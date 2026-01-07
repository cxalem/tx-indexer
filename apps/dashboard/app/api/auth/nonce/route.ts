import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { storeNonce, authRateLimiter, isRedisConfigured } from "@/lib/redis";

/**
 * Generates a random nonce for SIWS (Sign In With Solana)
 * The nonce is stored in Redis and must be used within 5 minutes
 */
export async function GET(request: NextRequest) {
  // Check if Redis is configured
  if (!isRedisConfigured()) {
    console.error("[Auth] Redis not configured - nonce storage unavailable");
    return NextResponse.json(
      { error: "Authentication service unavailable" },
      { status: 503 },
    );
  }

  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success, limit, reset, remaining } = await authRateLimiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      },
    );
  }

  // Generate a cryptographically secure nonce
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  // Store nonce in Redis with TTL
  await storeNonce(nonce);

  return NextResponse.json(
    { nonce, expiresAt },
    {
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      },
    },
  );
}

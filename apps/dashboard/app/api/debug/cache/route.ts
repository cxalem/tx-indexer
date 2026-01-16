import { NextResponse } from "next/server";
import {
  getTransactionCacheStats,
  getCachedTransactions,
  clearTransactionCache,
  clearAllTransactionCaches,
} from "@/lib/transaction-cache";
import { isRedisConfigured } from "@/lib/redis";

/**
 * Debug endpoint to check Redis cache status
 * Only available in development mode
 *
 * GET /api/debug/cache - Get cache stats
 * GET /api/debug/cache?wallet=<address> - Get cache for specific wallet
 * DELETE /api/debug/cache - Clear all caches
 * DELETE /api/debug/cache?wallet=<address> - Clear cache for specific wallet
 */
export async function GET(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Debug endpoints are only available in development" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("wallet");

  // Check Redis configuration
  const configured = isRedisConfigured();
  if (!configured) {
    return NextResponse.json({
      status: "not_configured",
      message:
        "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    });
  }

  // If wallet address provided, get that wallet's cache
  if (walletAddress) {
    const cached = await getCachedTransactions(walletAddress);
    if (!cached) {
      return NextResponse.json({
        status: "miss",
        wallet: walletAddress,
        message: "No cache found for this wallet",
      });
    }

    return NextResponse.json({
      status: "hit",
      wallet: walletAddress,
      transactionCount: cached.transactions.length,
      latestSignature: cached.latestSignature?.slice(0, 20) + "...",
      oldestSignature: cached.oldestSignature?.slice(0, 20) + "...",
      hasMore: cached.hasMore,
      cachedAt: new Date(cached.timestamp).toISOString(),
      ageSeconds: Math.floor((Date.now() - cached.timestamp) / 1000),
    });
  }

  // Otherwise, get overall cache stats
  const stats = await getTransactionCacheStats();
  if (!stats) {
    return NextResponse.json({
      status: "error",
      message: "Failed to get cache stats",
    });
  }

  return NextResponse.json({
    status: "ok",
    configured: stats.configured,
    cachedWallets: stats.keyCount,
    wallets: stats.keys.map((k) => k.slice(0, 8) + "..."),
  });
}

/**
 * DELETE /api/debug/cache - Clear all transaction caches
 * DELETE /api/debug/cache?wallet=<address> - Clear cache for specific wallet
 */
export async function DELETE(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Debug endpoints are only available in development" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("wallet");

  // Check Redis configuration
  const configured = isRedisConfigured();
  if (!configured) {
    return NextResponse.json({
      status: "not_configured",
      message:
        "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    });
  }

  try {
    if (walletAddress) {
      await clearTransactionCache(walletAddress);
      return NextResponse.json({
        status: "cleared",
        wallet: walletAddress,
        message: `Cache cleared for wallet ${walletAddress.slice(0, 8)}...`,
      });
    }

    // Clear all caches
    await clearAllTransactionCaches();
    return NextResponse.json({
      status: "cleared_all",
      message: "All transaction caches have been cleared",
    });
  } catch (error) {
    console.error("[Debug Cache] Failed to clear cache:", error);
    return NextResponse.json(
      { error: "Failed to clear cache" },
      { status: 500 },
    );
  }
}

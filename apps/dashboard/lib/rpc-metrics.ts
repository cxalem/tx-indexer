/**
 * RPC Metrics Tracking
 *
 * Tracks RPC calls, cache hits, and timing to measure the effectiveness
 * of the signatures-first approach vs traditional approach.
 */

// =============================================================================
// Types
// =============================================================================

export interface RpcCallMetric {
  /** Type of RPC call */
  type:
    | "getSignaturesForAddress"
    | "getTransaction"
    | "getTokenAccountsByOwner"
    | "other";
  /** Duration in milliseconds */
  durationMs: number;
  /** Timestamp */
  timestamp: number;
  /** Was this call avoided due to cache? */
  cached: boolean;
  /** Additional context */
  context?: string;
}

export interface RequestMetrics {
  /** Unique request ID */
  requestId: string;
  /** Request type */
  type: "traditional" | "signatures-first";
  /** Wallet address (truncated) */
  wallet: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** Total duration in ms */
  durationMs?: number;
  /** Number of signatures requested */
  signaturesRequested: number;
  /** Number of transactions returned */
  transactionsReturned: number;
  /** RPC calls made */
  rpcCalls: {
    signatures: number;
    transactions: number;
    tokenAccounts: number;
    total: number;
  };
  /** Cache stats */
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  /** Estimated RPC calls saved (vs no cache) */
  rpcCallsSaved: number;
}

export interface MetricsSummary {
  /** Total requests tracked */
  totalRequests: number;
  /** Breakdown by type */
  byType: {
    traditional: {
      count: number;
      avgDurationMs: number;
      avgRpcCalls: number;
      avgCacheHitRate: number;
    };
    signaturesFirst: {
      count: number;
      avgDurationMs: number;
      avgRpcCalls: number;
      avgCacheHitRate: number;
    };
  };
  /** Comparison */
  comparison: {
    rpcCallReduction: number; // Percentage
    durationReduction: number; // Percentage
    cacheHitImprovement: number; // Percentage points
  };
  /** Recent requests */
  recentRequests: RequestMetrics[];
}

// =============================================================================
// In-Memory Metrics Store
// =============================================================================

const MAX_STORED_REQUESTS = 100;
const requestMetrics: RequestMetrics[] = [];

// =============================================================================
// Metrics Collection
// =============================================================================

let requestCounter = 0;

/**
 * Start tracking a new request
 */
export function startRequestMetrics(
  type: "traditional" | "signatures-first",
  wallet: string,
  signaturesRequested: number,
): RequestMetrics {
  const metrics: RequestMetrics = {
    requestId: `${type}-${++requestCounter}-${Date.now()}`,
    type,
    wallet: wallet.slice(0, 8) + "...",
    startTime: Date.now(),
    signaturesRequested,
    transactionsReturned: 0,
    rpcCalls: {
      signatures: 0,
      transactions: 0,
      tokenAccounts: 0,
      total: 0,
    },
    cache: {
      hits: 0,
      misses: 0,
      hitRate: 0,
    },
    rpcCallsSaved: 0,
  };

  return metrics;
}

/**
 * Record an RPC call
 */
export function recordRpcCall(
  metrics: RequestMetrics,
  type: "signatures" | "transactions" | "tokenAccounts",
  count: number = 1,
): void {
  metrics.rpcCalls[type] += count;
  metrics.rpcCalls.total += count;
}

/**
 * Record cache stats
 */
export function recordCacheStats(
  metrics: RequestMetrics,
  hits: number,
  misses: number,
): void {
  metrics.cache.hits += hits;
  metrics.cache.misses += misses;
  const total = metrics.cache.hits + metrics.cache.misses;
  metrics.cache.hitRate = total > 0 ? metrics.cache.hits / total : 0;
}

/**
 * Finish tracking a request
 */
export function finishRequestMetrics(
  metrics: RequestMetrics,
  transactionsReturned: number,
): void {
  metrics.endTime = Date.now();
  metrics.durationMs = metrics.endTime - metrics.startTime;
  metrics.transactionsReturned = transactionsReturned;

  // Calculate RPC calls saved (cache hits = avoided transaction fetches)
  metrics.rpcCallsSaved = metrics.cache.hits;

  // Store metrics
  requestMetrics.unshift(metrics);
  if (requestMetrics.length > MAX_STORED_REQUESTS) {
    requestMetrics.pop();
  }

  // Log summary
  logRequestMetrics(metrics);
}

/**
 * Log request metrics
 */
function logRequestMetrics(metrics: RequestMetrics): void {
  const cacheHitPercent = Math.round(metrics.cache.hitRate * 100);
  const icon = metrics.type === "signatures-first" ? "🚀" : "📦";

  console.log(
    `${icon} [${metrics.type.toUpperCase()}] ${metrics.wallet} | ` +
      `${metrics.durationMs}ms | ` +
      `${metrics.rpcCalls.total} RPC calls | ` +
      `${cacheHitPercent}% cache hit | ` +
      `${metrics.rpcCallsSaved} calls saved | ` +
      `${metrics.transactionsReturned} txs`,
  );
}

// =============================================================================
// Metrics Summary
// =============================================================================

/**
 * Get metrics summary
 */
export function getMetricsSummary(): MetricsSummary {
  const traditional = requestMetrics.filter((m) => m.type === "traditional");
  const signaturesFirst = requestMetrics.filter(
    (m) => m.type === "signatures-first",
  );

  const avgMetrics = (requests: RequestMetrics[]) => {
    if (requests.length === 0) {
      return { avgDurationMs: 0, avgRpcCalls: 0, avgCacheHitRate: 0 };
    }
    const totalDuration = requests.reduce(
      (sum, r) => sum + (r.durationMs ?? 0),
      0,
    );
    const totalRpcCalls = requests.reduce(
      (sum, r) => sum + r.rpcCalls.total,
      0,
    );
    const totalCacheHitRate = requests.reduce(
      (sum, r) => sum + r.cache.hitRate,
      0,
    );
    return {
      avgDurationMs: Math.round(totalDuration / requests.length),
      avgRpcCalls: Math.round((totalRpcCalls / requests.length) * 10) / 10,
      avgCacheHitRate:
        Math.round((totalCacheHitRate / requests.length) * 1000) / 10,
    };
  };

  const traditionalAvg = avgMetrics(traditional);
  const signaturesFirstAvg = avgMetrics(signaturesFirst);

  // Calculate comparison
  let rpcCallReduction = 0;
  let durationReduction = 0;
  let cacheHitImprovement = 0;

  if (traditionalAvg.avgRpcCalls > 0 && signaturesFirstAvg.avgRpcCalls > 0) {
    rpcCallReduction =
      ((traditionalAvg.avgRpcCalls - signaturesFirstAvg.avgRpcCalls) /
        traditionalAvg.avgRpcCalls) *
      100;
  }

  if (
    traditionalAvg.avgDurationMs > 0 &&
    signaturesFirstAvg.avgDurationMs > 0
  ) {
    durationReduction =
      ((traditionalAvg.avgDurationMs - signaturesFirstAvg.avgDurationMs) /
        traditionalAvg.avgDurationMs) *
      100;
  }

  cacheHitImprovement =
    signaturesFirstAvg.avgCacheHitRate - traditionalAvg.avgCacheHitRate;

  return {
    totalRequests: requestMetrics.length,
    byType: {
      traditional: {
        count: traditional.length,
        ...traditionalAvg,
      },
      signaturesFirst: {
        count: signaturesFirst.length,
        ...signaturesFirstAvg,
      },
    },
    comparison: {
      rpcCallReduction: Math.round(rpcCallReduction * 10) / 10,
      durationReduction: Math.round(durationReduction * 10) / 10,
      cacheHitImprovement: Math.round(cacheHitImprovement * 10) / 10,
    },
    recentRequests: requestMetrics.slice(0, 10),
  };
}

/**
 * Clear all metrics
 */
export function clearMetrics(): void {
  requestMetrics.length = 0;
  requestCounter = 0;
}

/**
 * Format metrics summary for display
 */
export function formatMetricsSummary(summary: MetricsSummary): string {
  const lines: string[] = [
    "╔══════════════════════════════════════════════════════════════════╗",
    "║                    RPC METRICS COMPARISON                        ║",
    "╠══════════════════════════════════════════════════════════════════╣",
    "",
    `  Total Requests Tracked: ${summary.totalRequests}`,
    "",
    "  ┌─────────────────────┬─────────────────┬─────────────────────┐",
    "  │ Metric              │ Traditional     │ Signatures-First    │",
    "  ├─────────────────────┼─────────────────┼─────────────────────┤",
    `  │ Requests            │ ${String(summary.byType.traditional.count).padEnd(15)} │ ${String(summary.byType.signaturesFirst.count).padEnd(19)} │`,
    `  │ Avg Duration (ms)   │ ${String(summary.byType.traditional.avgDurationMs).padEnd(15)} │ ${String(summary.byType.signaturesFirst.avgDurationMs).padEnd(19)} │`,
    `  │ Avg RPC Calls       │ ${String(summary.byType.traditional.avgRpcCalls).padEnd(15)} │ ${String(summary.byType.signaturesFirst.avgRpcCalls).padEnd(19)} │`,
    `  │ Avg Cache Hit Rate  │ ${String(summary.byType.traditional.avgCacheHitRate + "%").padEnd(15)} │ ${String(summary.byType.signaturesFirst.avgCacheHitRate + "%").padEnd(19)} │`,
    "  └─────────────────────┴─────────────────┴─────────────────────┘",
    "",
    "  IMPROVEMENTS (Signatures-First vs Traditional):",
    `  • RPC Call Reduction:     ${summary.comparison.rpcCallReduction > 0 ? "↓" : "↑"} ${Math.abs(summary.comparison.rpcCallReduction)}%`,
    `  • Duration Reduction:     ${summary.comparison.durationReduction > 0 ? "↓" : "↑"} ${Math.abs(summary.comparison.durationReduction)}%`,
    `  • Cache Hit Improvement:  ${summary.comparison.cacheHitImprovement > 0 ? "+" : ""}${summary.comparison.cacheHitImprovement}%`,
    "",
    "╚══════════════════════════════════════════════════════════════════╝",
  ];

  return lines.join("\n");
}

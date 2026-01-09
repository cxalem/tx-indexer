/**
 * RPC Request Profiler
 *
 * A Bun test that reports how many network requests the SDK makes during
 * dashboard-like flows and highlights optimization opportunities.
 *
 * Run with:
 *   RPC_URL=<your-rpc-url> PROFILE_WALLET=<wallet-address> bun test src/__tests__/rpc-profiler.test.ts
 *
 * Environment Variables:
 *   - RPC_URL (required): Solana RPC endpoint URL
 *   - PROFILE_WALLET (required): Wallet address to profile
 *   - PROFILE_TX_LIMIT (optional): Number of transactions to fetch (default: 10)
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createIndexer, type TxIndexer } from "../index";

// ============================================
// CONFIGURATION
// ============================================

const RPC_URL = process.env.RPC_URL;
const PROFILE_WALLET = process.env.PROFILE_WALLET;
const TX_LIMIT = parseInt(process.env.PROFILE_TX_LIMIT || "10", 10);

// Test timeout (5 minutes to account for slow RPCs)
const TEST_TIMEOUT = 300_000;

// Delay between scenarios to avoid rate limiting (ms)
const SCENARIO_DELAY = 5000;

// ============================================
// RETRY HELPER
// ============================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 2000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRateLimit =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("Too Many Requests"));

      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(
          `  ⚠️  Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

// ============================================
// REQUEST TRACKING INFRASTRUCTURE
// ============================================

interface RequestRecord {
  url: string;
  host: string;
  method: string;
  rpcMethod?: string;
  timestamp: number;
  duration?: number;
}

interface RequestStats {
  totalRequests: number;
  byHost: Map<string, number>;
  byRpcMethod: Map<string, number>;
  requests: RequestRecord[];
}

class RequestProfiler {
  private originalFetch: typeof globalThis.fetch;
  private requests: RequestRecord[] = [];
  private isIntercepting = false;

  constructor() {
    this.originalFetch = globalThis.fetch;
  }

  start(): void {
    if (this.isIntercepting) return;
    this.isIntercepting = true;
    this.requests = [];

    const self = this;
    const originalFetch = this.originalFetch;

    const interceptedFetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const startTime = Date.now();
      let url: string;
      if (typeof input === "string") {
        url = input;
      } else if (input instanceof URL) {
        url = input.href;
      } else {
        url = input.url;
      }

      const host = new URL(url).host;
      const httpMethod = init?.method || "GET";

      let rpcMethod: string | undefined;
      if (init?.body) {
        try {
          let bodyStr: string;
          if (typeof init.body === "string") {
            bodyStr = init.body;
          } else if (init.body instanceof ArrayBuffer) {
            bodyStr = new TextDecoder().decode(init.body);
          } else if (init.body instanceof Uint8Array) {
            bodyStr = new TextDecoder().decode(init.body);
          } else {
            bodyStr = String(init.body);
          }
          const bodyJson = JSON.parse(bodyStr);

          if (Array.isArray(bodyJson)) {
            const methods = bodyJson
              .map((req: { method?: string }) => req.method)
              .filter(Boolean);
            rpcMethod =
              methods.length > 0 ? `batch[${methods.join(",")}]` : undefined;
          } else if (bodyJson.method) {
            rpcMethod = bodyJson.method;
          }
        } catch {
          // Not JSON
        }
      }

      const record: RequestRecord = {
        url,
        host,
        method: httpMethod,
        rpcMethod,
        timestamp: startTime,
      };

      self.requests.push(record);

      try {
        const response = await originalFetch.call(globalThis, input, init);
        record.duration = Date.now() - startTime;
        return response;
      } catch (error) {
        record.duration = Date.now() - startTime;
        throw error;
      }
    };

    // Preserve preconnect method if present
    Object.defineProperty(interceptedFetch, "preconnect", {
      value: (originalFetch as unknown as { preconnect?: unknown }).preconnect,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    globalThis.fetch = interceptedFetch as typeof fetch;
  }

  stop(): void {
    if (!this.isIntercepting) return;
    this.isIntercepting = false;
    globalThis.fetch = this.originalFetch;
  }

  reset(): void {
    this.requests = [];
  }

  getStats(): RequestStats {
    const byHost = new Map<string, number>();
    const byRpcMethod = new Map<string, number>();

    for (const req of this.requests) {
      byHost.set(req.host, (byHost.get(req.host) || 0) + 1);

      if (req.rpcMethod) {
        if (req.rpcMethod.startsWith("batch[")) {
          const methods = req.rpcMethod.slice(6, -1).split(",");
          for (const method of methods) {
            byRpcMethod.set(method, (byRpcMethod.get(method) || 0) + 1);
          }
        } else {
          byRpcMethod.set(
            req.rpcMethod,
            (byRpcMethod.get(req.rpcMethod) || 0) + 1,
          );
        }
      }
    }

    return {
      totalRequests: this.requests.length,
      byHost,
      byRpcMethod,
      requests: [...this.requests],
    };
  }
}

// ============================================
// REPORT FORMATTING
// ============================================

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatTopN(
  map: Map<string, number>,
  n: number = 10,
  label: string = "Item",
): string {
  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, n);

  if (top.length === 0) {
    return `  (no ${label.toLowerCase()}s recorded)\n`;
  }

  const maxLabelLen = Math.max(...top.map(([k]) => k.length), label.length);
  const maxCountLen = Math.max(
    ...top.map(([, v]) => formatNumber(v).length),
    "Count".length,
  );

  let result = `  ${"─".repeat(maxLabelLen + maxCountLen + 7)}\n`;
  result += `  │ ${label.padEnd(maxLabelLen)} │ ${"Count".padStart(maxCountLen)} │\n`;
  result += `  ${"─".repeat(maxLabelLen + maxCountLen + 7)}\n`;

  for (const [key, count] of top) {
    result += `  │ ${key.padEnd(maxLabelLen)} │ ${formatNumber(count).padStart(maxCountLen)} │\n`;
  }

  result += `  ${"─".repeat(maxLabelLen + maxCountLen + 7)}\n`;

  if (sorted.length > n) {
    result += `  ... and ${sorted.length - n} more\n`;
  }

  return result;
}

function printScenarioReport(name: string, stats: RequestStats): void {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${name}`);
  console.log("═".repeat(60));

  console.log(
    `\n📊 TOTAL HTTP REQUESTS: ${formatNumber(stats.totalRequests)}\n`,
  );

  console.log("📡 Requests by Host:");
  console.log(formatTopN(stats.byHost, 10, "Host"));

  console.log("🔧 Requests by JSON-RPC Method:");
  console.log(formatTopN(stats.byRpcMethod, 15, "Method"));
}

function printComparisonReport(
  baseline: RequestStats,
  optimized: RequestStats,
): void {
  console.log("\n" + "═".repeat(60));
  console.log("  📈 COMPARISON: Baseline vs Optimized");
  console.log("═".repeat(60));

  const totalDiff = baseline.totalRequests - optimized.totalRequests;
  const totalPctSaved =
    baseline.totalRequests > 0
      ? ((totalDiff / baseline.totalRequests) * 100).toFixed(1)
      : "0";

  console.log(`\n  Total Requests:`);
  console.log(`    Baseline:  ${formatNumber(baseline.totalRequests)}`);
  console.log(`    Optimized: ${formatNumber(optimized.totalRequests)}`);
  console.log(
    `    Saved:     ${formatNumber(totalDiff)} requests (${totalPctSaved}% reduction)`,
  );

  const allMethods = new Set([
    ...Array.from(baseline.byRpcMethod.keys()),
    ...Array.from(optimized.byRpcMethod.keys()),
  ]);

  const methodComparison: Array<{
    method: string;
    baseline: number;
    optimized: number;
    diff: number;
  }> = [];

  for (const method of Array.from(allMethods)) {
    const baselineCount = baseline.byRpcMethod.get(method) || 0;
    const optimizedCount = optimized.byRpcMethod.get(method) || 0;
    const diff = baselineCount - optimizedCount;

    if (diff !== 0) {
      methodComparison.push({
        method,
        baseline: baselineCount,
        optimized: optimizedCount,
        diff,
      });
    }
  }

  if (methodComparison.length > 0) {
    methodComparison.sort((a, b) => b.diff - a.diff);

    console.log(`\n  Request Savings by Method:`);
    console.log(`  ${"─".repeat(50)}`);

    for (const {
      method,
      baseline: b,
      optimized: o,
      diff,
    } of methodComparison) {
      const pct = b > 0 ? ((diff / b) * 100).toFixed(0) : "0";
      console.log(
        `    ${method}: ${b} → ${o} (${diff > 0 ? "-" : "+"}${Math.abs(diff)}, ${pct}% ${diff > 0 ? "saved" : "added"})`,
      );
    }
  }
}

function printInterpretation(
  baseline: RequestStats,
  optimized: RequestStats,
): void {
  console.log("\n" + "═".repeat(60));
  console.log("  💡 INTERPRETATION & OPTIMIZATION OPPORTUNITIES");
  console.log("═".repeat(60) + "\n");

  const suggestions: string[] = [];

  const getTransactionCount = baseline.byRpcMethod.get("getTransaction") || 0;
  const getSignaturesCount =
    baseline.byRpcMethod.get("getSignaturesForAddress") || 0;
  const getTokenAccountsCount =
    baseline.byRpcMethod.get("getTokenAccountsByOwner") || 0;
  const getBalanceCount = baseline.byRpcMethod.get("getBalance") || 0;
  const getAccountInfoCount = baseline.byRpcMethod.get("getAccountInfo") || 0;
  const getAssetCount = baseline.byRpcMethod.get("getAsset") || 0;
  const getAssetBatchCount = baseline.byRpcMethod.get("getAssetBatch") || 0;

  if (getTransactionCount > 10) {
    suggestions.push(
      `🔴 HIGH getTransaction calls (${getTransactionCount}): Each transaction fetch is expensive.\n` +
        `   → Consider reducing the transaction limit (currently fetching ${TX_LIMIT} txs)\n` +
        `   → Use pagination to load more only on user scroll\n` +
        `   → Cache transaction data client-side`,
    );
  }

  if (getSignaturesCount > 1) {
    suggestions.push(
      `🟡 Multiple getSignaturesForAddress calls (${getSignaturesCount}):\n` +
        `   → This happens when spam filtering removes transactions and SDK fetches more\n` +
        `   → Consider requesting more signatures upfront to reduce round trips\n` +
        `   → The SDK already handles this, but aggressive spam filtering can increase calls`,
    );
  }

  if (getTokenAccountsCount > 1) {
    suggestions.push(
      `🟡 Multiple getTokenAccountsByOwner calls (${getTokenAccountsCount}):\n` +
        `   → Cache token account list between balance refreshes\n` +
        `   → Token accounts rarely change, cache for 5-10 minutes`,
    );
  }

  if (getBalanceCount > 2) {
    suggestions.push(
      `🟡 Multiple getBalance calls (${getBalanceCount}):\n` +
        `   → Consider batching balance queries if possible\n` +
        `   → Cache SOL balance with short TTL (10-30 seconds)`,
    );
  }

  if (getAccountInfoCount > 5) {
    suggestions.push(
      `🟡 High getAccountInfo calls (${getAccountInfoCount}):\n` +
        `   → These are likely token metadata lookups\n` +
        `   → The SDK caches token metadata, but first load is expensive\n` +
        `   → Consider pre-warming the cache with common tokens`,
    );
  }

  if (getAssetCount > 0 || getAssetBatchCount > 0) {
    const totalNftCalls = getAssetCount + getAssetBatchCount;
    suggestions.push(
      `🟠 NFT metadata calls (${totalNftCalls} via getAsset/getAssetBatch):\n` +
        `   → NFT enrichment adds latency for each NFT transaction\n` +
        `   → Disable with enrichNftMetadata: false if not needed\n` +
        `   → The optimized scenario shows savings from disabling this`,
    );
  }

  const totalSaved = baseline.totalRequests - optimized.totalRequests;
  const pctSaved =
    baseline.totalRequests > 0
      ? ((totalSaved / baseline.totalRequests) * 100).toFixed(1)
      : "0";

  if (totalSaved > 0) {
    suggestions.push(
      `✅ OPTIMIZATION IMPACT: Disabling metadata enrichment saved ${totalSaved} requests (${pctSaved}%)\n` +
        `   → For faster initial load, consider:\n` +
        `     • Show transactions immediately without metadata\n` +
        `     • Lazy-load token names/images as user scrolls\n` +
        `     • Cache enriched data for subsequent views`,
    );
  } else if (totalSaved < 0) {
    suggestions.push(
      `ℹ️  Optimized scenario used ${Math.abs(totalSaved)} MORE requests than baseline.\n` +
        `   → This is likely due to run-to-run variance (spam filtering, caching)\n` +
        `   → Token metadata uses static registry (no extra RPC calls needed)\n` +
        `   → No NFT transactions detected that would benefit from disabling enrichment\n` +
        `   → The SDK is already well-optimized for this wallet's transaction types`,
    );
  } else {
    suggestions.push(
      `ℹ️  No difference between baseline and optimized scenarios.\n` +
        `   → Token metadata comes from static registry (no RPC calls)\n` +
        `   → No NFT transactions that require DAS lookups`,
    );
  }

  const hosts = Array.from(baseline.byHost.keys());
  if (hosts.length > 1) {
    suggestions.push(
      `📡 Requests distributed across ${hosts.length} hosts: ${hosts.join(", ")}\n` +
        `   → Multiple hosts indicate external API calls (token price, NFT metadata)\n` +
        `   → Consider consolidating to reduce connection overhead`,
    );
  }

  if (suggestions.length === 0) {
    console.log(
      "  ✅ Request profile looks optimal! No obvious optimization opportunities detected.\n",
    );
  } else {
    for (const suggestion of suggestions) {
      console.log(`  ${suggestion}\n`);
    }
  }

  console.log("═".repeat(60));
  console.log("  📋 SUMMARY");
  console.log("═".repeat(60));
  console.log(`
  Dashboard Load (${TX_LIMIT} transactions):
    • Baseline:  ${baseline.totalRequests} HTTP requests
    • Optimized: ${optimized.totalRequests} HTTP requests
    • Savings:   ${totalSaved} requests (${pctSaved}% reduction)

  Key metrics:
    • getTransaction calls: ${getTransactionCount}
    • Token metadata lookups: ${getAccountInfoCount}
    • NFT metadata lookups: ${getAssetCount + getAssetBatchCount}
`);
}

// ============================================
// TEST SUITE
// ============================================

// Skip tests if environment variables are not set
const SKIP_TESTS = !RPC_URL || !PROFILE_WALLET;

const describeOrSkip = SKIP_TESTS ? describe.skip : describe;

if (SKIP_TESTS) {
  console.log(`
═══════════════════════════════════════════════════════════════
  ⚠️  RPC Request Profiler - SKIPPED
═══════════════════════════════════════════════════════════════

  Missing required environment variables:
    ${!RPC_URL ? "• RPC_URL is not set" : ""}
    ${!PROFILE_WALLET ? "• PROFILE_WALLET is not set" : ""}

  To run this test, use:
    RPC_URL=<your-rpc-url> PROFILE_WALLET=<wallet-address> bun test src/__tests__/rpc-profiler.test.ts

  Optional:
    PROFILE_TX_LIMIT=<number>  # Default: 10
═══════════════════════════════════════════════════════════════
`);
}

describeOrSkip("RPC Request Profiler", () => {
  const profiler = new RequestProfiler();
  let indexer: TxIndexer;
  let baselineStats: RequestStats;
  let optimizedStats: RequestStats;

  beforeAll(() => {
    console.log("\n" + "═".repeat(60));
    console.log("  🔍 RPC REQUEST PROFILER");
    console.log("═".repeat(60));
    console.log(`
  Configuration:
    • RPC URL: ${RPC_URL!.substring(0, 50)}${RPC_URL!.length > 50 ? "..." : ""}
    • Wallet:  ${PROFILE_WALLET}
    • TX Limit: ${TX_LIMIT}
`);

    indexer = createIndexer({ rpcUrl: RPC_URL! });
    profiler.start();
  });

  afterAll(() => {
    profiler.stop();

    if (baselineStats && optimizedStats) {
      printComparisonReport(baselineStats, optimizedStats);
      printInterpretation(baselineStats, optimizedStats);
    }
  });

  test(
    "Scenario 1: Baseline dashboard load (balance + transactions with full enrichment)",
    async () => {
      profiler.reset();

      console.log("\n  ⏳ Running baseline scenario (full enrichment)...");

      const walletAddress = PROFILE_WALLET!;

      const { balance, transactions } = await withRetry(async () => {
        const [balance, transactions] = await Promise.all([
          indexer.getBalance(walletAddress),
          indexer.getTransactions(walletAddress, {
            limit: TX_LIMIT,
            filterSpam: true,
            enrichNftMetadata: true,
            enrichTokenMetadata: true,
          }),
        ]);
        return { balance, transactions };
      });

      baselineStats = profiler.getStats();

      expect(balance).toBeDefined();
      expect(balance.sol).toBeDefined();
      expect(transactions).toBeArray();

      console.log(
        `  ✓ Fetched balance and ${transactions.length} transactions`,
      );

      printScenarioReport("SCENARIO 1: Baseline Dashboard Load", baselineStats);

      // Wait before next scenario to avoid rate limiting
      console.log(
        `\n  ⏳ Waiting ${SCENARIO_DELAY / 1000}s to avoid rate limits...`,
      );
      await new Promise((resolve) => setTimeout(resolve, SCENARIO_DELAY));
    },
    TEST_TIMEOUT,
  );

  test(
    "Scenario 2: Optimized load (no metadata enrichment)",
    async () => {
      profiler.reset();

      console.log("  ⏳ Running optimized scenario (no enrichment)...");

      const walletAddress = PROFILE_WALLET!;

      const { balance, transactions } = await withRetry(async () => {
        const [balance, transactions] = await Promise.all([
          indexer.getBalance(walletAddress),
          indexer.getTransactions(walletAddress, {
            limit: TX_LIMIT,
            filterSpam: true,
            enrichNftMetadata: false,
            enrichTokenMetadata: false,
          }),
        ]);
        return { balance, transactions };
      });

      optimizedStats = profiler.getStats();

      expect(balance).toBeDefined();
      expect(transactions).toBeArray();

      console.log(
        `  ✓ Fetched balance and ${transactions.length} transactions`,
      );

      printScenarioReport(
        "SCENARIO 2: Optimized Load (No Enrichment)",
        optimizedStats,
      );

      console.log(
        `\n  ⏳ Waiting ${SCENARIO_DELAY / 1000}s to avoid rate limits...`,
      );
      await new Promise((resolve) => setTimeout(resolve, SCENARIO_DELAY));
    },
    TEST_TIMEOUT,
  );

  test(
    "Scenario 3: Diagnostic - No spam filter, maxIterations=1",
    async () => {
      profiler.reset();

      console.log(
        "  ⏳ Running diagnostic scenario (no spam filter, maxIterations=1)...",
      );

      const walletAddress = PROFILE_WALLET!;

      const { transactions } = await withRetry(async () => {
        const transactions = await indexer.getTransactions(walletAddress, {
          limit: TX_LIMIT,
          filterSpam: false,
          enrichNftMetadata: false,
          enrichTokenMetadata: false,
          maxIterations: 1,
        });
        return { transactions };
      });

      const diagnosticStats = profiler.getStats();

      expect(transactions).toBeArray();

      console.log(`  ✓ Fetched ${transactions.length} transactions`);

      printScenarioReport(
        "SCENARIO 3: Diagnostic (no spam filter, maxIterations=1)",
        diagnosticStats,
      );

      // Analysis
      const getTxCount = diagnosticStats.byRpcMethod.get("getTransaction") || 0;
      const getSigsCount =
        diagnosticStats.byRpcMethod.get("getSignaturesForAddress") || 0;

      console.log("\n  📊 DIAGNOSTIC ANALYSIS:");
      console.log(`  ─────────────────────────────────────────────────`);
      console.log(`  • Requested limit: ${TX_LIMIT}`);
      console.log(`  • Actual transactions returned: ${transactions.length}`);
      console.log(`  • getTransaction calls: ${getTxCount}`);
      console.log(`  • getSignaturesForAddress calls: ${getSigsCount}`);
      console.log(
        `  • Overfetch ratio: ${(getTxCount / TX_LIMIT).toFixed(1)}x`,
      );
      console.log(`  ─────────────────────────────────────────────────`);

      if (getTxCount > TX_LIMIT * 1.5) {
        console.log(
          `\n  ⚠️  SDK is fetching ${getTxCount} txs for limit=${TX_LIMIT}`,
        );
        console.log(
          `     This is due to pageSize = max(limit*2, 20) in accumulateUntilLimit()`,
        );
      }

      if (getSigsCount === 1) {
        console.log(`\n  ✅ Single signature fetch (no iteration needed)`);
      } else {
        console.log(
          `\n  ⚠️  Multiple signature fetches indicate iteration/spam filtering`,
        );
      }

      console.log(
        `\n  ⏳ Waiting ${SCENARIO_DELAY / 1000}s to avoid rate limits...`,
      );
      await new Promise((resolve) => setTimeout(resolve, SCENARIO_DELAY));
    },
    TEST_TIMEOUT,
  );

  test(
    "Scenario 4: Rate-limit optimized (minimal overfetch)",
    async () => {
      profiler.reset();

      console.log(
        "  ⏳ Running rate-limit optimized scenario (overfetchMultiplier=1, minPageSize=limit)...",
      );

      const walletAddress = PROFILE_WALLET!;

      const { transactions } = await withRetry(async () => {
        const transactions = await indexer.getTransactions(walletAddress, {
          limit: TX_LIMIT,
          filterSpam: false,
          enrichNftMetadata: false,
          enrichTokenMetadata: false,
          maxIterations: 1,
          // Rate-limit friendly settings
          overfetchMultiplier: 1,
          minPageSize: TX_LIMIT,
        });
        return { transactions };
      });

      const optimizedStats = profiler.getStats();

      expect(transactions).toBeArray();

      console.log(`  ✓ Fetched ${transactions.length} transactions`);

      printScenarioReport(
        "SCENARIO 4: Rate-Limit Optimized (minimal overfetch)",
        optimizedStats,
      );

      const getTxCount = optimizedStats.byRpcMethod.get("getTransaction") || 0;
      const getSigsCount =
        optimizedStats.byRpcMethod.get("getSignaturesForAddress") || 0;

      console.log("\n  📊 OPTIMIZED ANALYSIS:");
      console.log(`  ─────────────────────────────────────────────────`);
      console.log(`  • Requested limit: ${TX_LIMIT}`);
      console.log(`  • Actual transactions returned: ${transactions.length}`);
      console.log(`  • getTransaction calls: ${getTxCount}`);
      console.log(`  • getSignaturesForAddress calls: ${getSigsCount}`);
      console.log(
        `  • Overfetch ratio: ${(getTxCount / TX_LIMIT).toFixed(1)}x`,
      );
      console.log(`  ─────────────────────────────────────────────────`);

      if (getTxCount <= TX_LIMIT * 1.5) {
        console.log(`\n  ✅ Minimal overfetch achieved!`);
      }
    },
    TEST_TIMEOUT,
  );
});

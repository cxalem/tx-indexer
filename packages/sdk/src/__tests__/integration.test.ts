/**
 * Integration tests that hit Solana mainnet.
 *
 * These tests verify the full classification pipeline with real transactions.
 * They're slower than unit tests but provide confidence in real-world behavior.
 *
 * Run with: bun test integration
 *
 * NOTE: These tests use public RPC which has rate limits. If tests fail with 429,
 * either wait and retry, or use a private RPC endpoint via RPC_URL env var.
 */

import { describe, it, expect, beforeAll, afterEach } from "bun:test";
import { createIndexer, parseSignature, type TxIndexer } from "../index";

// Use custom RPC if provided, otherwise fall back to public RPC
const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

// Timeout for RPC calls (60 seconds to account for retries)
const TEST_TIMEOUT = 60000;

// Delay between tests to avoid rate limiting (ms)
const DELAY_BETWEEN_TESTS = 1000;

let indexer: TxIndexer;

beforeAll(() => {
  indexer = createIndexer({ rpcUrl: RPC_URL });
});

// Add delay between tests to avoid rate limiting
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_TESTS));
});

/**
 * Helper to retry a test if it fails due to rate limiting or network issues
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 2000,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  throw lastError;
}

// ============================================
// KNOWN GOOD TRANSACTIONS
// These are real mainnet transactions that we've verified work
// ============================================

const KNOWN_TRANSACTIONS = {
  // Jupiter swap: USDG -> USDC (verified working)
  JUPITER_SWAP:
    "4cu2aBEviivATT9mQbu7xEjaDaGokKk3phGmcqMT3X9v5nUmPLjvCmtU4oTSeWYhGmc1ShSQEjykgvGVq81TBxsF",

  // Raydium swap: token -> SOL (verified working)
  RAYDIUM_SWAP:
    "4C5ofWz1ZvHkQcXSEV3Sh2dMzRAnBycdQfzQuEKfn7MAmM5fnw1Kxf2n3WNBtx6WZtUKnytJLCNpVUWkoxEkhoD7",
};

// ============================================
// CORE SWAP TESTS
// ============================================

describe("Swap Classification", () => {
  it(
    "should classify Jupiter USDG->USDC swap correctly",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.JUPITER_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();
      expect(result!.classification.primaryType).toBe("swap");
      expect(result!.tx.protocol?.id).toBe("jupiter");
      expect(result!.tx.protocol?.name).toBe("Jupiter");

      // Should identify the main swap pair, not dust
      expect(result!.classification.primaryAmount?.token.symbol).toBe("USDG");
      expect(result!.classification.secondaryAmount?.token.symbol).toBe("USDC");

      // Amounts should be reasonable (around 2000 USDG -> 2000 USDC)
      expect(result!.classification.primaryAmount?.amountUi).toBeGreaterThan(
        1000,
      );
      expect(result!.classification.secondaryAmount?.amountUi).toBeGreaterThan(
        1000,
      );
    },
    TEST_TIMEOUT,
  );

  it(
    "should classify Raydium swap correctly",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.RAYDIUM_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();
      expect(result!.classification.primaryType).toBe("swap");
      expect(result!.tx.protocol?.id).toBe("raydium");

      // Output should be SOL
      expect(result!.classification.secondaryAmount?.token.symbol).toBe("SOL");
    },
    TEST_TIMEOUT,
  );
});

// ============================================
// TOKEN METADATA ENRICHMENT
// ============================================

describe("Token Metadata Enrichment", () => {
  it(
    "should enrich SOL with correct metadata",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.RAYDIUM_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();

      // Find SOL in legs
      const solLeg = result!.legs.find(
        (leg) => leg.amount.token.symbol === "SOL",
      );
      expect(solLeg).toBeDefined();
      expect(solLeg!.amount.token.name).toBe("Solana");
      expect(solLeg!.amount.token.decimals).toBe(9);
      expect(solLeg!.amount.token.logoURI).toBeDefined();
    },
    TEST_TIMEOUT,
  );

  it(
    "should enrich USDC from static registry",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.JUPITER_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();

      // USDC should be enriched from static registry
      const usdcLeg = result!.legs.find(
        (leg) => leg.amount.token.symbol === "USDC",
      );
      expect(usdcLeg).toBeDefined();
      expect(usdcLeg!.amount.token.name).toBe("USD Coin");
      expect(usdcLeg!.amount.token.decimals).toBe(6);
    },
    TEST_TIMEOUT,
  );

  it(
    "should handle unknown tokens with fallback",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.RAYDIUM_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();

      // Find any unknown token (has "Unknown Token" in name)
      const unknownLeg = result!.legs.find((leg) =>
        leg.amount.token.name?.includes("Unknown Token"),
      );

      // If there's an unknown token, verify it has proper fallback format
      if (unknownLeg) {
        expect(unknownLeg.amount.token.symbol.length).toBe(8);
        expect(unknownLeg.amount.token.decimals).toBeGreaterThanOrEqual(0);
      }
    },
    TEST_TIMEOUT,
  );
});

// ============================================
// TRANSACTION LEGS VALIDATION
// ============================================

describe("Transaction Legs", () => {
  it(
    "should have balanced legs (debits = credits per token)",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.JUPITER_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();
      expect(result!.legs.length).toBeGreaterThan(0);

      // Group by token and verify balance
      const byToken = new Map<string, { debits: number; credits: number }>();

      for (const leg of result!.legs) {
        const mint = leg.amount.token.mint;
        if (!byToken.has(mint)) {
          byToken.set(mint, { debits: 0, credits: 0 });
        }

        const balance = byToken.get(mint)!;
        if (leg.side === "debit") {
          balance.debits += leg.amount.amountUi;
        } else {
          balance.credits += leg.amount.amountUi;
        }
      }

      // Each token should roughly balance (allowing for small floating point errors)
      for (const [, balance] of byToken) {
        const diff = Math.abs(balance.debits - balance.credits);
        const maxAmount = Math.max(balance.debits, balance.credits);
        const tolerance = maxAmount * 0.0001; // 0.01% tolerance

        expect(diff).toBeLessThanOrEqual(Math.max(tolerance, 0.000001));
      }
    },
    TEST_TIMEOUT,
  );

  it(
    "should have valid leg roles and sides",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.RAYDIUM_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();

      const validRoles = [
        "sent",
        "received",
        "fee",
        "protocol_deposit",
        "protocol_withdraw",
      ];

      for (const leg of result!.legs) {
        expect(validRoles).toContain(leg.role);
        expect(["debit", "credit"]).toContain(leg.side);
        expect(leg.accountId).toBeDefined();
        expect(leg.amount.amountUi).not.toBe(0);
      }
    },
    TEST_TIMEOUT,
  );

  it(
    "should have network fee leg",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.RAYDIUM_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();

      // Should have a network fee leg
      const feeLeg = result!.legs.find(
        (leg) => leg.accountId === "fee:network",
      );
      expect(feeLeg).toBeDefined();
      expect(feeLeg!.role).toBe("fee");
      expect(feeLeg!.side).toBe("credit");
      expect(feeLeg!.amount.token.symbol).toBe("SOL");
    },
    TEST_TIMEOUT,
  );
});

// ============================================
// CLASSIFICATION CONFIDENCE
// ============================================

describe("Classification Confidence", () => {
  it(
    "should have high confidence for DEX swaps",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.RAYDIUM_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();
      // DEX swaps should have >= 0.9 confidence
      expect(result!.classification.confidence).toBeGreaterThanOrEqual(0.9);
    },
    TEST_TIMEOUT,
  );

  it(
    "should have valid confidence between 0 and 1",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.JUPITER_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();
      expect(result!.classification.confidence).toBeGreaterThanOrEqual(0);
      expect(result!.classification.confidence).toBeLessThanOrEqual(1);
    },
    TEST_TIMEOUT,
  );
});

// ============================================
// PROTOCOL DETECTION
// ============================================

describe("Protocol Detection", () => {
  it(
    "should detect Jupiter protocol",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.JUPITER_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();
      expect(result!.tx.protocol).not.toBeNull();
      expect(result!.tx.protocol?.id).toBe("jupiter");
      expect(result!.tx.protocol?.name).toBe("Jupiter");
    },
    TEST_TIMEOUT,
  );

  it(
    "should detect Raydium protocol",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.RAYDIUM_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();
      expect(result!.tx.protocol).not.toBeNull();
      expect(result!.tx.protocol?.id).toBe("raydium");
      expect(result!.tx.protocol?.name).toBe("Raydium");
    },
    TEST_TIMEOUT,
  );
});

// ============================================
// EDGE CASES
// ============================================

describe("Edge Cases", () => {
  it(
    "should return null for non-existent transaction",
    async () => {
      const result = await withRetry(async () => {
        // Invalid signature (all 1s)
        const sig = parseSignature(
          "1111111111111111111111111111111111111111111111111111111111111111",
        );
        return indexer.getTransaction(sig);
      });

      // Should return null, not throw
      expect(result).toBeNull();
    },
    TEST_TIMEOUT,
  );

  it(
    "should identify correct swap pair in multi-hop swap",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.JUPITER_SWAP);
        return indexer.getTransaction(sig);
      });

      expect(result).not.toBeNull();
      expect(result!.classification.primaryType).toBe("swap");

      // Should identify user's tokens, not intermediate routing tokens
      expect(result!.classification.primaryAmount).not.toBeNull();
      expect(result!.classification.secondaryAmount).not.toBeNull();

      // From and To should be different tokens
      expect(result!.classification.primaryAmount!.token.symbol).not.toBe(
        result!.classification.secondaryAmount!.token.symbol,
      );
    },
    TEST_TIMEOUT,
  );
});

// ============================================
// OPTION FLAGS
// ============================================

describe("Option Flags", () => {
  it(
    "should work with enrichTokenMetadata disabled",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.JUPITER_SWAP);
        return indexer.getTransaction(sig, { enrichTokenMetadata: false });
      });

      expect(result).not.toBeNull();
      expect(result!.classification.primaryType).toBe("swap");

      // Should still work, just might have Unknown tokens
      expect(result!.legs.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT,
  );
});

// ============================================
// RAW TRANSACTION ACCESS
// ============================================

describe("Raw Transaction", () => {
  it(
    "should return raw transaction data",
    async () => {
      const result = await withRetry(async () => {
        const sig = parseSignature(KNOWN_TRANSACTIONS.JUPITER_SWAP);
        return indexer.getRawTransaction(sig);
      });

      expect(result).not.toBeNull();
      expect(result!.signature).toBeDefined();
      expect(result!.slot).toBeDefined();
      expect(result!.programIds).toBeDefined();
      expect(result!.programIds.length).toBeGreaterThan(0);
      expect(result!.accountKeys).toBeDefined();
      expect(result!.accountKeys!.length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT,
  );
});

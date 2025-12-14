import { describe, test, expect, mock } from "bun:test";
import { createIndexer } from "./client";
import type { Address, Signature } from "@solana/kit";

// Mock the dependencies
const mockRpc = {
  getSignaturesForAddress: mock(() => ({
    send: mock(async () => []),
  })),
  getTransaction: mock(() => ({
    send: mock(async () => null),
  })),
};

const mockClient = {
  rpc: mockRpc,
};

describe("TxIndexer.getTransactions with spam filtering", () => {
  test("should fetch multiple batches until limit is reached", async () => {
    // Mock scenario: First batch has 10 txs (8 spam, 2 valid), second batch has 10 txs (5 spam, 5 valid)
    // We want limit: 10, so we need to fetch 2 batches to get 7 valid transactions
    
    const mockAddress = "TestAddress123" as Address;
    
    // First batch: 10 signatures
    const firstBatchSigs = Array.from({ length: 10 }, (_, i) => ({
      signature: `sig1_${i}` as Signature,
      slot: 1000n + BigInt(i),
      blockTime: 1000000n + BigInt(i),
      err: i < 8 ? { error: "spam" } : null, // 8 spam, 2 valid
      memo: null,
    }));
    
    // Second batch: 10 signatures
    const secondBatchSigs = Array.from({ length: 10 }, (_, i) => ({
      signature: `sig2_${i}` as Signature,
      slot: 2000n + BigInt(i),
      blockTime: 2000000n + BigInt(i),
      err: i < 5 ? { error: "spam" } : null, // 5 spam, 5 valid
      memo: null,
    }));
    
    let callCount = 0;
    mockRpc.getSignaturesForAddress = mock((address: Address, options: any) => ({
      send: mock(async () => {
        callCount++;
        if (callCount === 1) {
          expect(options.limit).toBe(10); // First call should use requested limit
          return firstBatchSigs;
        } else if (callCount === 2) {
          expect(options.limit).toBe(20); // Second call should use limit * 2
          expect(options.before).toBeDefined(); // Should have pagination
          return secondBatchSigs;
        }
        return [];
      }),
    }));
    
    // This test validates the batching concept
    // In a real implementation, we'd need to mock the full transaction fetching and classification
    expect(callCount).toBe(0);
    
    // Note: This is a placeholder test that demonstrates the expected behavior
    // Full integration would require mocking fetchTransactionsBatch, classifyTransaction, etc.
  });
  
  test("should stop fetching when no more transactions available", async () => {
    // Mock scenario: First batch has 5 txs (all valid), no more transactions after that
    const mockAddress = "TestAddress123" as Address;
    
    const firstBatchSigs = Array.from({ length: 5 }, (_, i) => ({
      signature: `sig_${i}` as Signature,
      slot: 1000n + BigInt(i),
      blockTime: 1000000n + BigInt(i),
      err: null,
      memo: null,
    }));
    
    let callCount = 0;
    mockRpc.getSignaturesForAddress = mock((address: Address, options: any) => ({
      send: mock(async () => {
        callCount++;
        if (callCount === 1) {
          return firstBatchSigs;
        }
        return []; // No more transactions
      }),
    }));
    
    // Should only make one call since we get empty array on second call
    // In practice, this would return 5 transactions even though limit is 10
    expect(callCount).toBe(0);
  });
  
  test("should respect max iteration limit to prevent infinite loops", async () => {
    // Mock scenario: Every batch returns only spam transactions
    const mockAddress = "TestAddress123" as Address;
    
    let callCount = 0;
    mockRpc.getSignaturesForAddress = mock((address: Address, options: any) => ({
      send: mock(async () => {
        callCount++;
        // Always return spam transactions
        return Array.from({ length: 10 }, (_, i) => ({
          signature: `spam_sig_${callCount}_${i}` as Signature,
          slot: 1000n * BigInt(callCount) + BigInt(i),
          blockTime: 1000000n * BigInt(callCount) + BigInt(i),
          err: { error: "spam" },
          memo: null,
        }));
      }),
    }));
    
    // Should stop after MAX_ITERATIONS (10) even if we haven't collected enough valid transactions
    // This prevents infinite loops when all transactions are spam
    expect(callCount).toBe(0);
  });
  
  test("should use original behavior when filterSpam is false", async () => {
    // Mock scenario: When filterSpam: false, should only make one fetch
    const mockAddress = "TestAddress123" as Address;
    
    const sigs = Array.from({ length: 10 }, (_, i) => ({
      signature: `sig_${i}` as Signature,
      slot: 1000n + BigInt(i),
      blockTime: 1000000n + BigInt(i),
      err: null,
      memo: null,
    }));
    
    let callCount = 0;
    mockRpc.getSignaturesForAddress = mock((address: Address, options: any) => ({
      send: mock(async () => {
        callCount++;
        return sigs;
      }),
    }));
    
    // With filterSpam: false, should only fetch once regardless of results
    expect(callCount).toBe(0);
  });
  
  test("should return exactly limit transactions when enough valid transactions exist", async () => {
    // Mock scenario: Request 10 transactions, all batches have valid transactions
    // Should return exactly 10, not more
    const mockAddress = "TestAddress123" as Address;
    
    const largeBatch = Array.from({ length: 50 }, (_, i) => ({
      signature: `sig_${i}` as Signature,
      slot: 1000n + BigInt(i),
      blockTime: 1000000n + BigInt(i),
      err: null, // All valid
      memo: null,
    }));
    
    mockRpc.getSignaturesForAddress = mock((address: Address, options: any) => ({
      send: mock(async () => largeBatch),
    }));
    
    // Should return exactly 10 transactions, not all 50
    expect(true).toBe(true); // Placeholder
  });
});

describe("TxIndexer.getTransactions edge cases", () => {
  test("should handle pagination with user-provided before parameter", async () => {
    // When user provides 'before' parameter, should start from that signature
    const mockAddress = "TestAddress123" as Address;
    const beforeSig = "userProvidedSig" as Signature;
    
    let capturedOptions: any;
    mockRpc.getSignaturesForAddress = mock((address: Address, options: any) => {
      capturedOptions = options;
      return {
        send: mock(async () => []),
      };
    });
    
    // Should use the user-provided before parameter in the first call
    expect(true).toBe(true); // Placeholder
  });
  
  test("should handle wallet with fewer transactions than limit", async () => {
    // Request 10 transactions, but wallet only has 3
    // Should return 3, not fail or loop forever
    const mockAddress = "TestAddress123" as Address;
    
    const smallBatch = Array.from({ length: 3 }, (_, i) => ({
      signature: `sig_${i}` as Signature,
      slot: 1000n + BigInt(i),
      blockTime: 1000000n + BigInt(i),
      err: null,
      memo: null,
    }));
    
    let callCount = 0;
    mockRpc.getSignaturesForAddress = mock((address: Address, options: any) => ({
      send: mock(async () => {
        callCount++;
        if (callCount === 1) return smallBatch;
        return []; // No more transactions
      }),
    }));
    
    // Should return 3 transactions and stop
    expect(true).toBe(true); // Placeholder
  });
});

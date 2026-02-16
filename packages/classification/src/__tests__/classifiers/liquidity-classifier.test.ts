import { describe, test, expect } from "bun:test";
import { LiquidityClassifier } from "../../classifiers/liquidity-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("LiquidityClassifier", () => {
  const classifier = new LiquidityClassifier();

  describe("add liquidity", () => {
    test("should classify adding SOL + USDC liquidity on Raydium", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createSolAmount(2.0),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createUsdcAmount(300),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createTokenAmount("SOL-USDC-LP", 6, 100),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "raydium", name: "Raydium" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("liquidity_add");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.secondaryAmount?.token.symbol).toBe("SOL");
      expect(result?.sender).toBe(userAddress);
      expect(result?.receiver).toBe(userAddress);
      expect(result?.confidence).toBe(0.85);
      expect(result?.metadata?.protocol).toBe("raydium");
    });

    test("should classify adding liquidity on Orca Whirlpool", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("mSOL", 9, 5.0),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(5.0),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("mSOL-SOL-LP", 6, 50),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "orca-whirlpool", name: "Orca Whirlpool" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("liquidity_add");
      expect(result?.metadata?.tokens_deposited).toHaveLength(2);
    });

    test("should classify adding liquidity on Meteora DLMM", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createUsdcAmount(500),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createTokenAmount("USDT", 6, 500),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createTokenAmount("USDC-USDT-LP", 6, 1000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "meteora-dlmm", name: "Meteora DLMM" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("liquidity_add");
      expect(result?.metadata?.protocol).toBe("meteora-dlmm");
    });
  });

  describe("remove liquidity", () => {
    test("should classify removing SOL + USDC liquidity on Raydium", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createTokenAmount("SOL-USDC-LP", 6, 100),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createSolAmount(2.0),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createUsdcAmount(300),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "raydium", name: "Raydium" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("liquidity_remove");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.secondaryAmount?.token.symbol).toBe("SOL");
      expect(result?.sender).toBe(userAddress);
      expect(result?.receiver).toBe(userAddress);
      expect(result?.metadata?.tokens_received).toHaveLength(2);
    });

    test("should classify removing liquidity on Meteora", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("USDC-USDT-LP", 6, 1000),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(500),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("USDT", 6, 500),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "meteora-pools", name: "Meteora Pools" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("liquidity_remove");
      expect(result?.metadata?.protocol).toBe("meteora-pools");
    });
  });

  describe("should NOT classify as liquidity", () => {
    test("should return null when no DEX protocol", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(150),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("LP", 6, 50),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake", name: "Stake Program" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null for a regular 1-to-1 swap (not LP)", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(150),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
        accountKeys: [userAddress],
      });

      const result = classifier.classify({ legs, tx });

      // 1 unique out, 1 unique in — this is a swap, not LP
      expect(result).toBeNull();
    });

    test("should return null when no account keys", () => {
      const legs = [
        createMockLeg({
          accountId: "external:USER123",
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "raydium", name: "Raydium" },
        accountKeys: [],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
  });
});

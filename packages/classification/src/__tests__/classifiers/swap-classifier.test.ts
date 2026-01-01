import { describe, test, expect } from "bun:test";
import { SwapClassifier } from "../../classifiers/swap-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
} from "../fixtures/mock-factories";

describe("SwapClassifier", () => {
  const classifier = new SwapClassifier();

  describe("swaps", () => {
    test("should classify SOL to USDC swap via Jupiter", () => {
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
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("swap");
      expect(result?.primaryAmount?.token.symbol).toBe("SOL");
      expect(result?.secondaryAmount?.token.symbol).toBe("USDC");
      expect(result?.sender).toBe(userAddress);
      expect(result?.receiver).toBe(userAddress);
      expect(result?.confidence).toBe(0.9);
      expect(result?.metadata?.swap_type).toBe("token_to_token");
    });

    test("should classify USDC to SOL swap via Raydium", () => {
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
          role: "sent",
          amount: createUsdcAmount(100),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(0.5),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "raydium", name: "Raydium" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("swap");
      expect(result?.metadata?.from_token).toBe("USDC");
      expect(result?.metadata?.to_token).toBe("SOL");
    });

    test("should include swap amounts in metadata", () => {
      const userAddress = "USER123";
      const fromAmount = 1.5;
      const toAmount = 225;
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
          role: "sent",
          amount: createSolAmount(fromAmount),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(toAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result?.metadata?.from_amount).toBe(fromAmount);
      expect(result?.metadata?.to_amount).toBe(toAmount);
    });

    test("should classify swap for fee payer in P2P transaction", () => {
      const feePayer = "FEE_PAYER";
      const counterparty = "COUNTERPARTY";
      const legs = [
        createMockLeg({
          accountId: `external:${feePayer}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${counterparty}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.6),
        }),
        createMockLeg({
          accountId: `external:${feePayer}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(74.71),
        }),
        createMockLeg({
          accountId: `external:${feePayer}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(0.6),
        }),
        createMockLeg({
          accountId: `external:${counterparty}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(74.71),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("swap");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.secondaryAmount?.token.symbol).toBe("SOL");
      expect(result?.sender).toBe(feePayer);
    });
  });

  describe("should NOT classify as swap", () => {
    test("should return null when no fee leg found", () => {
      const legs = [
        createMockLeg({
          accountId: "external:USER",
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
        createMockLeg({
          accountId: "external:USER",
          side: "credit",
          role: "received",
          amount: createUsdcAmount(150),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when fee payer has no token movements", () => {
      const feePayer = "FEE_PAYER";
      const other = "OTHER_USER";
      const legs = [
        createMockLeg({
          accountId: `external:${feePayer}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${other}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
        createMockLeg({
          accountId: `external:${other}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(150),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
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
          side: "credit",
          role: "received",
          amount: createUsdcAmount(150),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "metaplex", name: "Metaplex" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when same token in and out", () => {
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
          amount: createSolAmount(0.99),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when only tokens out", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when only tokens in", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(150),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
  });
});

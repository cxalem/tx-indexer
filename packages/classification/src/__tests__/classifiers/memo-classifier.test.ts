import { describe, test, expect } from "bun:test";
import { MemoClassifier } from "../../classifiers/memo-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
} from "../fixtures/mock-factories";

describe("MemoClassifier", () => {
  const classifier = new MemoClassifier();

  describe("memo transactions", () => {
    test("should classify pure memo transaction", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
      ];
      const tx = createMockTransaction({
        memo: "Hello, Solana!",
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("memo");
      expect(result?.primaryAmount).toBeNull();
      expect(result?.sender).toBe(user);
      expect(result?.confidence).toBe(0.9);
      expect(result?.metadata?.memo).toBe("Hello, Solana!");
    });

    test("should classify memo with no legs at all", () => {
      const user = "USER123";
      const legs: ReturnType<typeof createMockLeg>[] = [];
      const tx = createMockTransaction({
        memo: "On-chain data anchor",
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("memo");
    });
  });

  describe("should NOT classify as memo", () => {
    test("should return null when no memo", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when memo exists but there are token movements", () => {
      const user = "USER123";
      const receiver = "RECEIVER456";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(100),
        }),
        createMockLeg({
          accountId: `external:${receiver}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(100),
        }),
      ];
      const tx = createMockTransaction({
        memo: "Payment for services",
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });
  });
});

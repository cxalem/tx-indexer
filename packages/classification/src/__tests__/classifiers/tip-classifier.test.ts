import { describe, test, expect } from "bun:test";
import { TipClassifier } from "../../classifiers/tip-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
} from "../fixtures/mock-factories";

describe("TipClassifier", () => {
  const classifier = new TipClassifier();

  describe("tip transactions", () => {
    test("should classify Jito tip transaction", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.001),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jito-tip", name: "Jito Tip" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("tip");
      expect(result?.primaryAmount?.token.symbol).toBe("SOL");
      expect(result?.sender).toBe(user);
      expect(result?.confidence).toBe(0.9);
      expect(result?.metadata?.tip_amount_sol).toBe(0.001);
    });

    test("should classify Jito tip payment", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.005),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jito-tip-payment", name: "Jito Tip Payment" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("tip");
    });
  });

  describe("should NOT classify as tip", () => {
    test("should return null when no tip protocol", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.001),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when no SOL debits", () => {
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
        protocol: { id: "jito-tip", name: "Jito Tip" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });
  });
});

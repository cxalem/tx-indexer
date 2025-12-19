import { describe, test, expect } from "bun:test";
import { FeeOnlyClassifier } from "../../classifiers/fee-only-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("FeeOnlyClassifier", () => {
  const classifier = new FeeOnlyClassifier();

  describe("fee-only transactions", () => {
    test("should classify transaction with only fee leg", () => {
      const feePayerAddress = "FEE_PAYER123";
      const feeAmount = 0.000005;
      const legs = [
        createMockLeg({
          accountId: `external:${feePayerAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(feeAmount),
        }),
        createMockLeg({
          accountId: `fee:network`,
          side: "credit",
          role: "fee",
          amount: createSolAmount(feeAmount),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("fee_only");
      expect(result?.primaryAmount?.amountUi).toBe(feeAmount);
      expect(result?.sender).toBe(feePayerAddress);
      expect(result?.confidence).toBe(0.95);
      expect(result?.isRelevant).toBe(false);
      expect(result?.metadata?.fee_type).toBe("network");
    });

    test("should mark as not relevant", () => {
      const feePayerAddress = "FEE_PAYER123";
      const legs = [
        createMockLeg({
          accountId: `external:${feePayerAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result?.isRelevant).toBe(false);
    });
  });

  describe("should NOT classify as fee-only", () => {
    test("should return null when participant has non-fee legs", () => {
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
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when participant received tokens", () => {
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
          side: "credit",
          role: "received",
          amount: createTokenAmount("BONK", 5, 1000),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no fee legs at all", () => {
      const legs = [
        createMockLeg({
          accountId: `external:SOME_ADDRESS`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
  });
});

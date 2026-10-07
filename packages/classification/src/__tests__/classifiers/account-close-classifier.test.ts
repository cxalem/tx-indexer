import { describe, test, expect } from "bun:test";
import { AccountCloseClassifier } from "../../classifiers/account-close-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
} from "../fixtures/mock-factories";

describe("AccountCloseClassifier", () => {
  const classifier = new AccountCloseClassifier();

  describe("account close", () => {
    test("should classify closing a token account (reclaim rent SOL)", () => {
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
          side: "credit",
          role: "received",
          amount: createSolAmount(0.00203928),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("account_close");
      expect(result?.primaryAmount?.token.symbol).toBe("SOL");
      expect(result?.receiver).toBe(user);
      expect(result?.metadata?.accounts_closed).toBe(1);
      expect(result?.confidence).toBe(0.9);
    });

    test("should classify closing multiple token accounts", () => {
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
          side: "credit",
          role: "received",
          amount: createSolAmount(0.00203928),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(0.00203928),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(0.00203928),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("account_close");
      expect(result?.metadata?.accounts_closed).toBe(3);
    });
  });

  describe("should NOT classify as account close", () => {
    test("should return null when user also has non-SOL token movements", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(0.00203928),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(100),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when user has non-fee SOL debits (transfer)", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(5),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(0.00203928),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when no SOL credits", () => {
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
  });
});

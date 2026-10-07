import { describe, test, expect } from "bun:test";
import { EscrowClassifier } from "../../classifiers/escrow-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
} from "../fixtures/mock-factories";

describe("EscrowClassifier", () => {
  const classifier = new EscrowClassifier();

  describe("escrow create", () => {
    test("should classify escrow creation (user sends tokens to protocol)", () => {
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
          amount: createUsdcAmount(500),
        }),
        createMockLeg({
          accountId: "protocol:escrow-vault",
          side: "credit",
          role: "received",
          amount: createUsdcAmount(500),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("escrow_create");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.sender).toBe(user);
      expect(result?.confidence).toBe(0.7);
    });
  });

  describe("escrow release", () => {
    test("should classify escrow release (user receives tokens from protocol)", () => {
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
          amount: createUsdcAmount(500),
        }),
        createMockLeg({
          accountId: "protocol:escrow-vault",
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(500),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("escrow_release");
      expect(result?.receiver).toBe(user);
    });
  });

  describe("should NOT classify as escrow", () => {
    test("should return null when no protocol legs", () => {
      const user = "USER123";
      const receiver = "RECEIVER456";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(500),
        }),
        createMockLeg({
          accountId: `external:${receiver}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(500),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when transaction has a known protocol", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(500),
        }),
        createMockLeg({
          accountId: "protocol:jupiter",
          side: "credit",
          role: "received",
          amount: createUsdcAmount(500),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when multiple token types (swap-like)", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(500),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(5),
        }),
        createMockLeg({
          accountId: "protocol:vault",
          side: "credit",
          role: "received",
          amount: createUsdcAmount(500),
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

import { describe, test, expect } from "bun:test";
import { TokenCreateClassifier } from "../../classifiers/token-create-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("TokenCreateClassifier", () => {
  const classifier = new TokenCreateClassifier();

  describe("token creation", () => {
    test("should classify Pump.fun token launch", () => {
      const creator = "CREATOR123";
      const legs = [
        createMockLeg({
          accountId: `external:${creator}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${creator}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.02),
        }),
        createMockLeg({
          accountId: `external:${creator}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("NEWCOIN", 6, 1_000_000_000),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [creator],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_create");
      expect(result?.primaryAmount?.token.symbol).toBe("NEWCOIN");
      expect(result?.sender).toBe(creator);
      expect(result?.metadata?.initial_supply).toBe(1_000_000_000);
      expect(result?.metadata?.sol_cost).toBe(0.02);
    });

    test("should classify SPL token mint with large supply", () => {
      const creator = "CREATOR123";
      const legs = [
        createMockLeg({
          accountId: `external:${creator}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.05),
        }),
        createMockLeg({
          accountId: `external:${creator}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("MYTOKEN", 9, 10_000_000),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [creator],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_create");
      expect(result?.confidence).toBe(0.8);
    });
  });

  describe("should NOT classify as token create", () => {
    test("should return null when user also sends non-SOL tokens (swap)", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("USDC", 6, 100),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("BONK", 5, 50000),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when received amount is small (not initial supply)", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.01),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("TOKEN", 6, 50),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when no credits", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.02),
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

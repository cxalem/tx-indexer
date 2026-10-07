import { describe, test, expect } from "bun:test";
import { TokenBurnClassifier } from "../../classifiers/token-burn-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("TokenBurnClassifier", () => {
  const classifier = new TokenBurnClassifier();

  describe("token burns", () => {
    test("should classify burning fungible tokens", () => {
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
          amount: createTokenAmount("BONK", 5, 1000000),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_burn");
      expect(result?.primaryAmount?.token.symbol).toBe("BONK");
      expect(result?.sender).toBe(user);
      expect(result?.metadata?.burned_token).toBe("BONK");
      expect(result?.confidence).toBe(0.85);
    });

    test("should pick the largest burn amount", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("BONK", 5, 100),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("SHIB", 8, 50000),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryAmount?.token.symbol).toBe("SHIB");
    });
  });

  describe("should NOT classify as token burn", () => {
    test("should return null when token goes to external account (transfer)", () => {
      const sender = "SENDER123";
      const receiver = "RECEIVER456";
      const bonk = createTokenAmount("BONK", 5, 1000000);
      const legs = [
        createMockLeg({
          accountId: `external:${sender}`,
          side: "debit",
          role: "sent",
          amount: bonk,
        }),
        createMockLeg({
          accountId: `external:${receiver}`,
          side: "credit",
          role: "received",
          amount: bonk,
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [sender],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when user also receives tokens (swap)", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("BONK", 5, 1000000),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(50),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when only SOL debits (not token burn)", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(10),
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

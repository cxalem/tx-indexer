import { describe, test, expect } from "bun:test";
import { CompressClassifier } from "../../classifiers/compress-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("CompressClassifier", () => {
  const classifier = new CompressClassifier();

  describe("compress", () => {
    test("should classify token compression (send tokens to compressed state)", () => {
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
          amount: createTokenAmount("USDC", 6, 100),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "light-protocol", name: "Light Protocol" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("compress");
      expect(result?.sender).toBe(user);
      expect(result?.metadata?.token).toBe("USDC");
    });

    test("should classify SOL compression", () => {
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
        protocol: { id: "account-compression", name: "Account Compression" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("compress");
    });
  });

  describe("decompress", () => {
    test("should classify token decompression", () => {
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
          amount: createTokenAmount("USDC", 6, 100),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "light-protocol", name: "Light Protocol" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("decompress");
      expect(result?.receiver).toBe(user);
    });
  });

  describe("should NOT classify as compress", () => {
    test("should return null when no compression protocol", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("USDC", 6, 100),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when no token movements", () => {
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
        protocol: { id: "light-protocol", name: "Light Protocol" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });
  });
});

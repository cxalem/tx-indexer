import { describe, test, expect } from "bun:test";
import { AirdropClassifier } from "../../classifiers/airdrop-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("AirdropClassifier", () => {
  const classifier = new AirdropClassifier();

  describe("airdrops", () => {
    test("should classify token airdrop from protocol", () => {
      const receiverAddress = "RECEIVER123";
      const senderAddress = "AIRDROP_PROTOCOL";
      const legs = [
        createMockLeg({
          accountId: `protocol:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("BONK", 5, 1000000),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("BONK", 5, 1000000),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("airdrop");
      expect(result?.primaryAmount?.token.symbol).toBe("BONK");
      expect(result?.receiver).toBe(receiverAddress);
      expect(result?.sender).toBe(senderAddress);
      expect(result?.metadata?.airdrop_type).toBe("token");
    });

    test("should include token info in metadata", () => {
      const receiverAddress = "RECEIVER123";
      const airdropAmount = 1000;
      const legs = [
        createMockLeg({
          accountId: `protocol:AIRDROP_PROTOCOL`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("JUP", 6, airdropAmount),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("JUP", 6, airdropAmount),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result?.metadata?.token).toBe("JUP");
      expect(result?.metadata?.amount).toBe(airdropAmount);
    });

    test("should handle facilitator", () => {
      const receiverAddress = "RECEIVER123";
      const legs = [
        createMockLeg({
          accountId: `protocol:AIRDROP_PROTOCOL`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("BONK", 5, 1000),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("BONK", 5, 1000),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: ["2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"],
      });

      const result = classifier.classify({ legs, tx });

      expect(result?.metadata?.facilitator).toBe("payai");
    });
  });

  describe("should NOT classify as airdrop", () => {
    test("should return null when no protocol legs", () => {
      const senderAddress = "SENDER123";
      const receiverAddress = "RECEIVER456";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("BONK", 5, 1000),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("BONK", 5, 1000),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when receiving SOL (not token)", () => {
      const receiverAddress = "RECEIVER123";
      const legs = [
        createMockLeg({
          accountId: `protocol:SOME_PROTOCOL`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when user also sent tokens", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `protocol:SOME_PROTOCOL`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("BONK", 5, 1000),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("USDC", 6, 100),
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

    test("should return null when no tokens received", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `protocol:SOME_PROTOCOL`,
          side: "debit",
          role: "protocol_deposit",
          amount: createSolAmount(1.0),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
  });
});

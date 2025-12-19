import { describe, test, expect } from "bun:test";
import { TransferClassifier } from "../../classifiers/transfer-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("TransferClassifier", () => {
  const classifier = new TransferClassifier();

  describe("transfers", () => {
    test("should classify SOL transfer", () => {
      const senderAddress = "SENDER123";
      const receiverAddress = "RECEIVER456";
      const transferAmount = 1.5;
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(transferAmount),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(transferAmount),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("transfer");
      expect(result?.primaryAmount?.amountUi).toBe(transferAmount);
      expect(result?.sender).toBe(senderAddress);
      expect(result?.receiver).toBe(receiverAddress);
      expect(result?.counterparty?.address).toBe(receiverAddress);
      expect(result?.confidence).toBe(0.95);
    });

    test("should classify USDC transfer", () => {
      const senderAddress = "SENDER123";
      const receiverAddress = "RECEIVER456";
      const transferAmount = 100;
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(transferAmount),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(transferAmount),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("transfer");
      expect(result?.sender).toBe(senderAddress);
      expect(result?.receiver).toBe(receiverAddress);
    });

    test("should handle transfer with facilitator", () => {
      const senderAddress = "SENDER123";
      const receiverAddress = "RECEIVER456";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${senderAddress}`,
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
      const tx = createMockTransaction({
        accountKeys: ["2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4"],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.metadata?.facilitator).toBe("payai");
      expect(result?.metadata?.payment_type).toBe("facilitated");
    });

    test("should match tokens by mint address", () => {
      const senderAddress = "SENDER123";
      const receiverAddress = "RECEIVER456";
      const usdcMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("USDC", 6, 0.15, usdcMint),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createTokenAmount("USDC", 6, 0.15, usdcMint),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.sender).toBe(senderAddress);
      expect(result?.receiver).toBe(receiverAddress);
    });
  });

  describe("should NOT classify", () => {
    test("should return null when no sender", () => {
      const legs = [
        createMockLeg({
          accountId: `external:SOME_ADDRESS`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no receiver", () => {
      const senderAddress = "SENDER123";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when receiver has protocol prefix", () => {
      const senderAddress = "SENDER123";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(0.15),
        }),
        createMockLeg({
          accountId: `protocol:SOME_PROTOCOL`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(0.15),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
  });
});

import { describe, test, expect } from "bun:test";
import { SolanaPayClassifier } from "../../classifiers/solana-pay-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
} from "../fixtures/mock-factories";

const SPL_MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

describe("SolanaPayClassifier", () => {
  const classifier = new SolanaPayClassifier();

  describe("Solana Pay transactions", () => {
    test("should classify Solana Pay transaction with merchant memo", () => {
      const senderAddress = "SENDER123";
      const receiverAddress = "MERCHANT456";
      const memo = JSON.stringify({
        merchant: "Coffee Shop",
        item: "Latte",
        reference: "order-123",
      });
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
          amount: createUsdcAmount(5.0),
        }),
        createMockLeg({
          accountId: `external:${receiverAddress}`,
          side: "credit",
          role: "received",
          amount: createUsdcAmount(5.0),
        }),
      ];
      const tx = createMockTransaction({
        programIds: [SPL_MEMO_PROGRAM_ID],
        memo,
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("transfer");
      expect(result?.sender).toBe(senderAddress);
      expect(result?.receiver).toBe(receiverAddress);
      expect(result?.counterparty?.address).toBe(receiverAddress);
      expect(result?.counterparty?.name).toBe("Coffee Shop");
      expect(result?.counterparty?.type).toBe("merchant");
      expect(result?.metadata?.payment_type).toBe("solana_pay");
      expect(result?.metadata?.merchant).toBe("Coffee Shop");
      expect(result?.metadata?.item).toBe("Latte");
    });

    test("should classify Solana Pay with plain text memo", () => {
      const senderAddress = "SENDER123";
      const receiverAddress = "RECEIVER456";
      const memo = "Order #12345";
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
        programIds: [SPL_MEMO_PROGRAM_ID],
        memo,
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.metadata?.memo).toBe(memo);
      expect(result?.sender).toBe(senderAddress);
      expect(result?.receiver).toBe(receiverAddress);
    });

    test("should have high confidence for Solana Pay", () => {
      const senderAddress = "SENDER123";
      const memo = JSON.stringify({ merchant: "Test Store" });
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
      const tx = createMockTransaction({
        programIds: [SPL_MEMO_PROGRAM_ID],
        memo,
      });

      const result = classifier.classify({ legs, tx });

      expect(result?.confidence).toBe(0.98);
    });

    test("should include all memo fields in metadata", () => {
      const senderAddress = "SENDER123";
      const memo = JSON.stringify({
        merchant: "Store",
        item: "Product",
        reference: "ref-123",
        label: "Payment",
        message: "Thank you",
      });
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        programIds: [SPL_MEMO_PROGRAM_ID],
        memo,
      });

      const result = classifier.classify({ legs, tx });

      expect(result?.metadata?.merchant).toBe("Store");
      expect(result?.metadata?.item).toBe("Product");
      expect(result?.metadata?.reference).toBe("ref-123");
      expect(result?.metadata?.label).toBe("Payment");
      expect(result?.metadata?.message).toBe("Thank you");
    });
  });

  describe("should NOT classify as Solana Pay", () => {
    test("should return null when no memo program", () => {
      const senderAddress = "SENDER123";
      const memo = JSON.stringify({ merchant: "Test" });
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        programIds: [],
        memo,
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no memo", () => {
      const senderAddress = "SENDER123";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        programIds: [SPL_MEMO_PROGRAM_ID],
        memo: null,
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when memo is undefined", () => {
      const senderAddress = "SENDER123";
      const legs = [
        createMockLeg({
          accountId: `external:${senderAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        programIds: [SPL_MEMO_PROGRAM_ID],
        memo: undefined,
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
  });
});

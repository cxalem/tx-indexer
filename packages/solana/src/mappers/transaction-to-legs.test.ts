import { describe, test, expect } from "bun:test";
import { transactionToLegs } from "./transaction-to-legs";
import type { RawTransaction } from "@tx-indexer/core/tx/tx.types";
import type { Signature } from "@solana/kit";

function createMockTransaction(
  overrides: Partial<RawTransaction> = {},
): RawTransaction {
  return {
    signature: "test-signature" as Signature,
    slot: 123456789n,
    blockTime: 1700000000n,
    err: null,
    programIds: [],
    protocol: null,
    preTokenBalances: [],
    postTokenBalances: [],
    preBalances: [],
    postBalances: [],
    accountKeys: [],
    memo: null,
    ...overrides,
  };
}

describe("transactionToLegs", () => {
  describe("fee handling", () => {
    test("creates network fee leg from balance imbalance", () => {
      const tx = createMockTransaction({
        fee: 5000,
        accountKeys: ["FeePayerAddress"],
        preBalances: [1000000000],
        postBalances: [999995000],
      });

      const legs = transactionToLegs(tx);

      const networkFeeLeg = legs.find(
        (leg) => leg.accountId === "fee:network" && leg.role === "fee",
      );

      expect(networkFeeLeg).toBeDefined();
      expect(networkFeeLeg!.side).toBe("credit");
      expect(networkFeeLeg!.amount.amountRaw).toBe("5000");
    });

    test("marks fee payer SOL debit as sent (fee tracked separately)", () => {
      const tx = createMockTransaction({
        fee: 5000,
        accountKeys: ["FeePayerAddress", "ReceiverAddress"],
        preBalances: [1000000000, 500000000],
        postBalances: [999000000, 501000000],
      });

      const legs = transactionToLegs(tx);

      const feePayerLeg = legs.find(
        (leg) =>
          leg.accountId === "external:FeePayerAddress" && leg.side === "debit",
      );

      expect(feePayerLeg).toBeDefined();
      expect(feePayerLeg!.role).toBe("sent");
    });

    test("small SOL transfers are not misclassified as fees", () => {
      const tx = createMockTransaction({
        fee: 5000,
        accountKeys: ["FeePayerAddress", "ReceiverAddress"],
        preBalances: [1000000000, 500000000],
        postBalances: [994995000, 505000000],
      });

      const legs = transactionToLegs(tx);

      const sentLegs = legs.filter(
        (leg) =>
          leg.accountId === "external:FeePayerAddress" &&
          leg.side === "debit" &&
          leg.role === "sent",
      );

      expect(sentLegs.length).toBeGreaterThan(0);
      expect(sentLegs[0]!.amount.amountUi).toBeCloseTo(0.005, 5);
    });
  });

  describe("SOL balance changes", () => {
    test("creates credit leg for SOL received", () => {
      const tx = createMockTransaction({
        fee: 5000,
        accountKeys: ["SenderAddress", "ReceiverAddress"],
        preBalances: [1000000000, 500000000],
        postBalances: [999000000, 501000000],
      });

      const legs = transactionToLegs(tx);

      const receiverLeg = legs.find(
        (leg) =>
          leg.accountId === "external:ReceiverAddress" && leg.side === "credit",
      );

      expect(receiverLeg).toBeDefined();
      expect(receiverLeg!.role).toBe("received");
      expect(receiverLeg!.amount.amountUi).toBeCloseTo(0.001, 5);
    });

    test("ignores zero balance changes", () => {
      const tx = createMockTransaction({
        fee: 5000,
        accountKeys: ["Address1", "Address2"],
        preBalances: [1000000000, 500000000],
        postBalances: [1000000000, 500000000],
      });

      const legs = transactionToLegs(tx);

      const externalLegs = legs.filter((leg) =>
        leg.accountId.startsWith("external:"),
      );

      expect(externalLegs).toHaveLength(0);
    });
  });
});

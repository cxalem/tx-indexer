import { describe, test, expect } from "bun:test";
import { StakeWithdrawClassifier } from "../../classifiers/stake-withdraw-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
} from "../fixtures/mock-factories";

describe("StakeWithdrawClassifier", () => {
  const classifier = new StakeWithdrawClassifier();

  describe("stake withdrawals", () => {
    test("should classify native SOL stake withdrawal", () => {
      const withdrawerAddress = "WITHDRAWER123";
      const withdrawAmount = 5.0;
      const legs = [
        createMockLeg({
          accountId: `external:${withdrawerAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${withdrawerAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(withdrawAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake", name: "Stake Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("stake_withdraw");
      expect(result?.primaryAmount?.amountUi).toBe(withdrawAmount);
      expect(result?.receiver).toBe(withdrawerAddress);
      expect(result?.confidence).toBe(0.9);
      expect(result?.metadata?.withdraw_amount).toBe(withdrawAmount);
    });

    test("should classify stake pool withdrawal", () => {
      const withdrawerAddress = "WITHDRAWER123";
      const withdrawAmount = 10.0;
      const legs = [
        createMockLeg({
          accountId: `external:${withdrawerAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${withdrawerAddress}`,
          side: "credit",
          role: "protocol_withdraw",
          amount: createSolAmount(withdrawAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake-pool", name: "Stake Pool Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("stake_withdraw");
      expect(result?.metadata?.protocol).toBe("stake-pool");
    });
  });

  describe("should NOT classify as stake withdraw", () => {
    test("should return null when no stake protocol", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(5.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no SOL credit found", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake", name: "Stake Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when both deposit and withdrawal present", () => {
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
          amount: createSolAmount(10.0),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(10.5),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake", name: "Stake Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
  });
});

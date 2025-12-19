import { describe, test, expect } from "bun:test";
import { StakeDepositClassifier } from "../../classifiers/stake-deposit-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
} from "../fixtures/mock-factories";

describe("StakeDepositClassifier", () => {
  const classifier = new StakeDepositClassifier();

  describe("stake deposits", () => {
    test("should classify native SOL stake deposit", () => {
      const stakerAddress = "STAKER123";
      const stakeAmount = 10.0;
      const legs = [
        createMockLeg({
          accountId: `external:${stakerAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${stakerAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(stakeAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake", name: "Stake Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("stake_deposit");
      expect(result?.primaryAmount?.amountUi).toBe(stakeAmount);
      expect(result?.sender).toBe(stakerAddress);
      expect(result?.confidence).toBe(0.9);
      expect(result?.metadata?.stake_amount).toBe(stakeAmount);
    });

    test("should classify stake pool deposit", () => {
      const stakerAddress = "STAKER123";
      const stakeAmount = 5.0;
      const legs = [
        createMockLeg({
          accountId: `external:${stakerAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${stakerAddress}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createSolAmount(stakeAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake-pool", name: "Stake Pool Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("stake_deposit");
      expect(result?.metadata?.protocol).toBe("stake-pool");
    });
  });

  describe("should NOT classify as stake deposit", () => {
    test("should return null when no stake protocol", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(10.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no SOL debit found", () => {
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
  });
});

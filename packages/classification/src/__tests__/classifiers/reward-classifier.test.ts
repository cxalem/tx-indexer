import { describe, test, expect } from "bun:test";
import { RewardClassifier } from "../../classifiers/reward-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
} from "../fixtures/mock-factories";

describe("RewardClassifier", () => {
  const classifier = new RewardClassifier();

  describe("staking rewards", () => {
    test("should classify SOL staking reward", () => {
      const userAddress = "USER123";
      const rewardAmount = 0.05;
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "reward",
          amount: createSolAmount(rewardAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake", name: "Stake Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("reward");
      expect(result?.primaryAmount?.token.symbol).toBe("SOL");
      expect(result?.primaryAmount?.amountUi).toBe(rewardAmount);
      expect(result?.receiver).toBe(userAddress);
      expect(result?.sender).toBeNull();
      expect(result?.confidence).toBe(0.85);
      expect(result?.metadata?.reward_type).toBe("staking");
      expect(result?.metadata?.protocol).toBe("stake");
    });

    test("should classify stake pool reward", () => {
      const userAddress = "USER123";
      const rewardAmount = 0.1;
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "reward",
          amount: createSolAmount(rewardAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake-pool", name: "Stake Pool Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("reward");
      expect(result?.metadata?.protocol).toBe("stake-pool");
    });

    test("should pick largest reward when multiple reward legs exist", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "reward",
          amount: createSolAmount(0.01),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "reward",
          amount: createSolAmount(0.05),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake", name: "Stake Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("reward");
      expect(result?.primaryAmount?.amountUi).toBe(0.05);
      expect(result?.metadata?.rewards).toHaveLength(2);
    });

    test("should include fee legs without misclassifying", () => {
      const userAddress = "USER123";
      const rewardAmount = 0.03;
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "reward",
          amount: createSolAmount(rewardAmount),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake", name: "Stake Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("reward");
      expect(result?.primaryAmount?.amountUi).toBe(rewardAmount);
    });
  });

  describe("should NOT classify as reward", () => {
    test("should return null when no staking protocol", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "reward",
          amount: createSolAmount(0.05),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no reward legs exist", () => {
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
        protocol: { id: "stake", name: "Stake Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when user also sends tokens (stake/unstake, not pure reward)", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(10.0),
        }),
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "reward",
          amount: createSolAmount(0.05),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake", name: "Stake Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when reward legs are from protocol accounts", () => {
      const legs = [
        createMockLeg({
          accountId: "protocol:stake-pool",
          side: "credit",
          role: "reward",
          amount: createSolAmount(0.05),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "stake", name: "Stake Program" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no protocol is present", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "reward",
          amount: createSolAmount(0.05),
        }),
      ];
      const tx = createMockTransaction({
        protocol: null,
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
  });
});

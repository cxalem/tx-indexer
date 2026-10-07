import { describe, test, expect } from "bun:test";
import { DcaClassifier } from "../../classifiers/dca-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
} from "../fixtures/mock-factories";

describe("DcaClassifier", () => {
  const classifier = new DcaClassifier();

  describe("DCA deposits", () => {
    test("should classify USDC DCA deposit on Jupiter DCA", () => {
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
          role: "protocol_deposit",
          amount: createUsdcAmount(1000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter-dca", name: "Jupiter DCA" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("dca_deposit");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.sender).toBe(user);
      expect(result?.metadata?.dca_token).toBe("USDC");
    });

    test("should classify SOL DCA deposit", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createSolAmount(50),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter-dca", name: "Jupiter DCA" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("dca_deposit");
    });
  });

  describe("DCA withdrawals", () => {
    test("should classify DCA withdrawal (reclaim unspent tokens)", () => {
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
          role: "protocol_withdraw",
          amount: createUsdcAmount(500),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter-dca", name: "Jupiter DCA" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("dca_withdraw");
      expect(result?.receiver).toBe(user);
    });
  });

  describe("should NOT classify as DCA", () => {
    test("should return null when not a DCA protocol", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createUsdcAmount(1000),
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
        protocol: { id: "jupiter-dca", name: "Jupiter DCA" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });
  });
});

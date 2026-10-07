import { describe, test, expect } from "bun:test";
import { PerpsClassifier } from "../../classifiers/perps-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
} from "../fixtures/mock-factories";

describe("PerpsClassifier", () => {
  const classifier = new PerpsClassifier();

  describe("open positions", () => {
    test("should classify opening a position on Drift (deposit USDC margin)", () => {
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
          amount: createUsdcAmount(5000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "drift", name: "Drift" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("perp_open");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.sender).toBe(user);
      expect(result?.metadata?.collateral_token).toBe("USDC");
    });

    test("should classify opening position on Zeta", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createSolAmount(20),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "zeta", name: "Zeta Markets" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("perp_open");
    });
  });

  describe("close positions", () => {
    test("should classify closing a position on Jupiter Perps (receive PnL)", () => {
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
          amount: createUsdcAmount(7500),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter-perps", name: "Jupiter Perps" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("perp_close");
      expect(result?.receiver).toBe(user);
    });
  });

  describe("should NOT classify as perps", () => {
    test("should return null when no perps protocol", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "protocol_deposit",
          amount: createUsdcAmount(5000),
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
        protocol: { id: "drift", name: "Drift" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });
  });
});

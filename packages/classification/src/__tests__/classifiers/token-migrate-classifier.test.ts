import { describe, test, expect } from "bun:test";
import { TokenMigrateClassifier } from "../../classifiers/token-migrate-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("TokenMigrateClassifier", () => {
  const classifier = new TokenMigrateClassifier();

  describe("token migration", () => {
    test("should classify Pump.fun graduation to Raydium", () => {
      const migrator = "MIGRATOR123";
      const legs = [
        createMockLeg({
          accountId: `external:${migrator}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: "protocol:raydium",
          side: "debit",
          role: "protocol_deposit",
          amount: createTokenAmount("NEWCOIN", 6, 800_000_000),
        }),
        createMockLeg({
          accountId: "protocol:raydium",
          side: "credit",
          role: "protocol_withdraw",
          amount: createSolAmount(80),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "raydium", name: "Raydium" },
        accountKeys: [migrator],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("token_migrate");
      expect(result?.primaryAmount?.token.symbol).toBe("NEWCOIN");
      expect(result?.metadata?.migrated_token).toBe("NEWCOIN");
      expect(result?.confidence).toBe(0.75);
    });
  });

  describe("should NOT classify as token migrate", () => {
    test("should return null when not a DEX protocol", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: "protocol:marginfi",
          side: "debit",
          role: "protocol_deposit",
          amount: createTokenAmount("TOKEN", 6, 5_000_000),
        }),
        createMockLeg({
          accountId: "protocol:marginfi",
          side: "credit",
          role: "protocol_withdraw",
          amount: createSolAmount(50),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "marginfi", name: "Marginfi" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when amounts are small (regular swap)", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: "protocol:raydium",
          side: "debit",
          role: "protocol_deposit",
          amount: createTokenAmount("BONK", 5, 500),
        }),
        createMockLeg({
          accountId: "protocol:raydium",
          side: "credit",
          role: "protocol_withdraw",
          amount: createSolAmount(0.5),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "raydium", name: "Raydium" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when fewer than 2 protocol legs", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: "protocol:raydium",
          side: "debit",
          role: "protocol_deposit",
          amount: createTokenAmount("TOKEN", 6, 5_000_000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "raydium", name: "Raydium" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });
  });
});

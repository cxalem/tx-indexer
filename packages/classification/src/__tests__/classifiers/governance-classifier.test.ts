import { describe, test, expect } from "bun:test";
import { GovernanceClassifier } from "../../classifiers/governance-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createTokenAmount,
} from "../fixtures/mock-factories";

describe("GovernanceClassifier", () => {
  const classifier = new GovernanceClassifier();

  describe("governance votes", () => {
    test("should classify governance vote (deposit governance tokens)", () => {
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
          role: "sent",
          amount: createTokenAmount("MNGO", 6, 1000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "spl-governance", name: "SPL Governance (Realms)" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("governance_vote");
      expect(result?.primaryAmount?.token.symbol).toBe("MNGO");
      expect(result?.sender).toBe(user);
      expect(result?.confidence).toBe(0.8);
    });
  });

  describe("governance proposals", () => {
    test("should classify proposal creation (fee-only)", () => {
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
        protocol: { id: "spl-governance", name: "SPL Governance (Realms)" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("governance_proposal");
      expect(result?.confidence).toBe(0.75);
    });
  });

  describe("should NOT classify as governance", () => {
    test("should return null when no governance protocol", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createTokenAmount("MNGO", 6, 1000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when no accountKeys", () => {
      const legs = [
        createMockLeg({
          accountId: "external:USER123",
          side: "debit",
          role: "sent",
          amount: createTokenAmount("MNGO", 6, 1000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "spl-governance", name: "SPL Governance (Realms)" },
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });
  });
});

import { describe, test, expect } from "bun:test";
import { MultisigClassifier } from "../../classifiers/multisig-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createUsdcAmount,
} from "../fixtures/mock-factories";

describe("MultisigClassifier", () => {
  const classifier = new MultisigClassifier();

  describe("multisig execute", () => {
    test("should classify multisig execution with token movement", () => {
      const signer = "SIGNER123";
      const legs = [
        createMockLeg({
          accountId: `external:${signer}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${signer}`,
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(5000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "squads-v4", name: "Squads V4" },
        accountKeys: [signer],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("multisig_execute");
      expect(result?.primaryAmount?.token.symbol).toBe("USDC");
      expect(result?.sender).toBe(signer);
      expect(result?.confidence).toBe(0.85);
    });

    test("should classify Squads V3 execution", () => {
      const signer = "SIGNER123";
      const receiver = "RECEIVER456";
      const legs = [
        createMockLeg({
          accountId: `external:${signer}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
        createMockLeg({
          accountId: `external:${receiver}`,
          side: "credit",
          role: "received",
          amount: createSolAmount(10),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "squads-v3", name: "Squads V3" },
        accountKeys: [signer],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("multisig_execute");
    });
  });

  describe("multisig approve", () => {
    test("should classify multisig approval (fee-only, no token movement)", () => {
      const signer = "SIGNER123";
      const legs = [
        createMockLeg({
          accountId: `external:${signer}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.000005),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "squads-v4", name: "Squads V4" },
        accountKeys: [signer],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("multisig_approve");
      expect(result?.primaryAmount).toBeNull();
      expect(result?.metadata?.signer).toBe(signer);
      expect(result?.confidence).toBe(0.8);
    });
  });

  describe("should NOT classify as multisig", () => {
    test("should return null when no multisig protocol", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
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

    test("should return null when no accountKeys", () => {
      const legs = [
        createMockLeg({
          accountId: "external:USER123",
          side: "debit",
          role: "sent",
          amount: createUsdcAmount(5000),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "squads-v4", name: "Squads V4" },
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });
  });
});

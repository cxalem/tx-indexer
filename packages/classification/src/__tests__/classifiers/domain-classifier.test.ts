import { describe, test, expect } from "bun:test";
import { DomainClassifier } from "../../classifiers/domain-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createNftAmount,
} from "../fixtures/mock-factories";

describe("DomainClassifier", () => {
  const classifier = new DomainClassifier();

  describe("domain registration", () => {
    test("should classify .sol domain registration (pay SOL)", () => {
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
          amount: createSolAmount(0.5),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "sns", name: "Solana Name Service" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("domain_register");
      expect(result?.primaryAmount?.token.symbol).toBe("SOL");
      expect(result?.sender).toBe(user);
      expect(result?.metadata?.payment_token).toBe("SOL");
    });

    test("should classify AllDomains registration", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "alldomains", name: "AllDomains" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("domain_register");
    });
  });

  describe("domain transfer", () => {
    test("should classify domain NFT transfer", () => {
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
          amount: createNftAmount("example.sol"),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "sns", name: "Solana Name Service" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("domain_transfer");
      expect(result?.sender).toBe(user);
    });
  });

  describe("should NOT classify as domain", () => {
    test("should return null when no domain protocol", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(0.5),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });
  });
});

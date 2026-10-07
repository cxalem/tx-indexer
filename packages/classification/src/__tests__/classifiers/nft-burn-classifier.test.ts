import { describe, test, expect } from "bun:test";
import { NftBurnClassifier } from "../../classifiers/nft-burn-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createNftAmount,
} from "../fixtures/mock-factories";

describe("NftBurnClassifier", () => {
  const classifier = new NftBurnClassifier();

  describe("NFT burns", () => {
    test("should classify burning an NFT (debit with no external credit)", () => {
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
          amount: createNftAmount("DeGod #1234"),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("nft_burn");
      expect(result?.sender).toBe(user);
      expect(result?.metadata?.nft_name).toBe("DeGod #1234");
      expect(result?.metadata?.nfts_burned).toBe(1);
      expect(result?.confidence).toBe(0.85);
    });

    test("should classify burning multiple NFTs", () => {
      const user = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createNftAmount("NFT #1"),
        }),
        createMockLeg({
          accountId: `external:${user}`,
          side: "debit",
          role: "sent",
          amount: createNftAmount("NFT #2"),
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [user],
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("nft_burn");
      expect(result?.metadata?.nfts_burned).toBe(2);
    });
  });

  describe("should NOT classify as NFT burn", () => {
    test("should return null when NFT goes to another external account (transfer)", () => {
      const sender = "SENDER123";
      const receiver = "RECEIVER456";
      const nft = createNftAmount("DeGod #1234");
      const legs = [
        createMockLeg({
          accountId: `external:${sender}`,
          side: "debit",
          role: "sent",
          amount: nft,
        }),
        createMockLeg({
          accountId: `external:${receiver}`,
          side: "credit",
          role: "received",
          amount: nft,
        }),
      ];
      const tx = createMockTransaction({
        accountKeys: [sender],
      });

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });

    test("should return null when no NFT debits", () => {
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
          amount: createNftAmount("NFT #1"),
        }),
      ];
      const tx = createMockTransaction();

      const result = classifier.classify({ legs, tx });
      expect(result).toBeNull();
    });
  });
});

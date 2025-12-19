import { describe, test, expect } from "bun:test";
import { NftMintClassifier } from "../../classifiers/nft-mint-classifier";
import {
  createMockTransaction,
  createMockLeg,
  createSolAmount,
  createNftAmount,
} from "../fixtures/mock-factories";

describe("NftMintClassifier", () => {
  const classifier = new NftMintClassifier();

  describe("NFT mints", () => {
    test("should classify single NFT mint via Candy Machine", () => {
      const minterAddress = "MINTER123";
      const legs = [
        createMockLeg({
          accountId: `external:${minterAddress}`,
          side: "debit",
          role: "fee",
          amount: createSolAmount(0.01),
        }),
        createMockLeg({
          accountId: `external:${minterAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.5),
        }),
        createMockLeg({
          accountId: `external:${minterAddress}`,
          side: "credit",
          role: "received",
          amount: createNftAmount("Cool NFT #1"),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "candy-machine-v3", name: "Candy Machine V3" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("nft_mint");
      expect(result?.primaryAmount?.token.decimals).toBe(0);
      expect(result?.receiver).toBe(minterAddress);
      expect(result?.confidence).toBe(0.9);
      expect(result?.metadata?.quantity).toBe(1);
      expect(result?.metadata?.mint_price).toBe(1.5);
    });

    test("should classify NFT mint via Bubblegum", () => {
      const minterAddress = "MINTER123";
      const legs = [
        createMockLeg({
          accountId: `external:${minterAddress}`,
          side: "credit",
          role: "received",
          amount: createNftAmount("Compressed NFT"),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "bubblegum", name: "Bubblegum" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("nft_mint");
      expect(result?.metadata?.protocol).toBe("bubblegum");
    });

    test("should classify NFT mint via Metaplex", () => {
      const minterAddress = "MINTER123";
      const legs = [
        createMockLeg({
          accountId: `external:${minterAddress}`,
          side: "credit",
          role: "received",
          amount: createNftAmount("Mad Lad #1234"),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "metaplex", name: "Metaplex" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.primaryType).toBe("nft_mint");
      expect(result?.receiver).toBe(minterAddress);
    });

    test("should handle batch mint (multiple NFTs)", () => {
      const minterAddress = "MINTER123";
      const legs = [
        createMockLeg({
          accountId: `external:${minterAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(3.0),
        }),
        createMockLeg({
          accountId: `external:${minterAddress}`,
          side: "credit",
          role: "received",
          amount: createNftAmount("NFT #1"),
        }),
        createMockLeg({
          accountId: `external:${minterAddress}`,
          side: "credit",
          role: "received",
          amount: createNftAmount("NFT #2"),
        }),
        createMockLeg({
          accountId: `external:${minterAddress}`,
          side: "credit",
          role: "received",
          amount: createNftAmount("NFT #3"),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "candy-machine-v3", name: "Candy Machine V3" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.metadata?.quantity).toBe(3);
    });

    test("should handle free mint (no SOL payment)", () => {
      const minterAddress = "MINTER123";
      const legs = [
        createMockLeg({
          accountId: `external:${minterAddress}`,
          side: "credit",
          role: "received",
          amount: createNftAmount("Free NFT"),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "metaplex", name: "Metaplex" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).not.toBeNull();
      expect(result?.metadata?.mint_price).toBeUndefined();
    });
  });

  describe("should NOT classify as NFT mint", () => {
    test("should return null when no NFT mint protocol", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: createNftAmount("Some NFT"),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "jupiter", name: "Jupiter" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when no NFT credits found", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "debit",
          role: "sent",
          amount: createSolAmount(1.0),
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "metaplex", name: "Metaplex" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });

    test("should return null when token has decimals > 0", () => {
      const userAddress = "USER123";
      const legs = [
        createMockLeg({
          accountId: `external:${userAddress}`,
          side: "credit",
          role: "received",
          amount: {
            token: { mint: "TOKEN_MINT", symbol: "TKN", name: "Token", decimals: 6 },
            amountRaw: "1000000",
            amountUi: 1,
          },
        }),
      ];
      const tx = createMockTransaction({
        protocol: { id: "metaplex", name: "Metaplex" },
      });

      const result = classifier.classify({ legs, tx });

      expect(result).toBeNull();
    });
  });
});

import { describe, it, expect, beforeEach } from "bun:test";
import { createTokenFetcher, type TokenFetcher } from "./token-fetcher";
import { KNOWN_TOKENS, TOKEN_INFO } from "./token-registry";

describe("TokenFetcher", () => {
  let fetcher: TokenFetcher;

  beforeEach(() => {
    fetcher = createTokenFetcher();
  });

  describe("getToken", () => {
    it("should return SOL from static registry", async () => {
      const token = await fetcher.getToken(KNOWN_TOKENS.SOL);

      expect(token.symbol).toBe("SOL");
      expect(token.name).toBe("Solana");
      expect(token.decimals).toBe(9);
      expect(token.logoURI).toBeDefined();
    });

    it("should return USDC from static registry", async () => {
      const token = await fetcher.getToken(KNOWN_TOKENS.USDC);

      expect(token.symbol).toBe("USDC");
      expect(token.name).toBe("USD Coin");
      expect(token.decimals).toBe(6);
    });

    it("should return JUP from static registry", async () => {
      const token = await fetcher.getToken(KNOWN_TOKENS.JUP);

      expect(token.symbol).toBe("JUP");
      expect(token.name).toBe("Jupiter");
      expect(token.decimals).toBe(6);
    });

    it("should return BONK from static registry", async () => {
      const token = await fetcher.getToken(KNOWN_TOKENS.BONK);

      expect(token.symbol).toBe("BONK");
      expect(token.name).toBe("Bonk");
      expect(token.decimals).toBe(5);
    });

    it("should return JitoSOL from static registry", async () => {
      const token = await fetcher.getToken(KNOWN_TOKENS.JITOSOL);

      expect(token.symbol).toBe("JitoSOL");
      expect(token.name).toBe("Jito Staked SOL");
      expect(token.decimals).toBe(9);
    });

    it("should return unknown token for unrecognized mint", async () => {
      const unknownMint = "UnknownMint1111111111111111111111111111111";
      const token = await fetcher.getToken(unknownMint, 6);

      expect(token.symbol).toBe("UnknownM");
      expect(token.name).toBe("Unknown Token (UnknownM...)");
      expect(token.decimals).toBe(6);
      expect(token.logoURI).toBeUndefined();
    });

    it("should use provided decimals for unknown tokens", async () => {
      const unknownMint = "TestMint11111111111111111111111111111111111";
      const token = await fetcher.getToken(unknownMint, 8);

      expect(token.decimals).toBe(8);
    });
  });

  describe("getTokens", () => {
    it("should return multiple tokens from static registry", async () => {
      const mints = [KNOWN_TOKENS.SOL, KNOWN_TOKENS.USDC, KNOWN_TOKENS.JUP];
      const tokens = await fetcher.getTokens(mints);

      expect(tokens.size).toBe(3);
      expect(tokens.get(KNOWN_TOKENS.SOL)?.symbol).toBe("SOL");
      expect(tokens.get(KNOWN_TOKENS.USDC)?.symbol).toBe("USDC");
      expect(tokens.get(KNOWN_TOKENS.JUP)?.symbol).toBe("JUP");
    });

    it("should handle mix of known and unknown tokens", async () => {
      const unknownMint = "Unknown111111111111111111111111111111111111";
      const mints = [KNOWN_TOKENS.SOL, unknownMint];
      const tokens = await fetcher.getTokens(mints, 9);

      expect(tokens.size).toBe(2);
      expect(tokens.get(KNOWN_TOKENS.SOL)?.symbol).toBe("SOL");
      expect(tokens.get(unknownMint)?.symbol).toBe("Unknown1");
    });

    it("should return empty map for empty input", async () => {
      const tokens = await fetcher.getTokens([]);
      expect(tokens.size).toBe(0);
    });
  });

  describe("static registry coverage", () => {
    it("should have all stablecoins", async () => {
      const stablecoins = [
        KNOWN_TOKENS.USDC,
        KNOWN_TOKENS.USDT,
        KNOWN_TOKENS.PYUSD,
        KNOWN_TOKENS.USDG,
      ];

      for (const mint of stablecoins) {
        const token = await fetcher.getToken(mint);
        expect(token.name).not.toContain("Unknown");
      }
    });

    it("should have all liquid staking tokens", async () => {
      const lstTokens = [
        KNOWN_TOKENS.MSOL,
        KNOWN_TOKENS.JITOSOL,
        KNOWN_TOKENS.BSOL,
      ];

      for (const mint of lstTokens) {
        const token = await fetcher.getToken(mint);
        expect(token.name).not.toContain("Unknown");
      }
    });

    it("should have popular memecoins", async () => {
      const memecoins = [
        KNOWN_TOKENS.BONK,
        KNOWN_TOKENS.WIF,
        KNOWN_TOKENS.POPCAT,
      ];

      for (const mint of memecoins) {
        const token = await fetcher.getToken(mint);
        expect(token.name).not.toContain("Unknown");
      }
    });
  });

  describe("getCacheSize", () => {
    it("should return 0 when no Jupiter tokens fetched", () => {
      expect(fetcher.getCacheSize()).toBe(0);
    });
  });
});

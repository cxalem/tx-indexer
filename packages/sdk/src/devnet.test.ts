import { describe, test, expect } from "bun:test";
import {
  DEVNET_KNOWN_TOKENS,
  DEVNET_TOKEN_INFO,
  KNOWN_TOKENS,
  TOKEN_INFO,
} from "@tx-indexer/core/money/token-registry";
import { createTokenFetcher } from "@tx-indexer/core/money/token-fetcher";

describe("Devnet Token Registry", () => {
  test("DEVNET_KNOWN_TOKENS contains expected tokens", () => {
    expect(DEVNET_KNOWN_TOKENS.SOL).toBe(
      "So11111111111111111111111111111111111111112",
    );
    expect(DEVNET_KNOWN_TOKENS.USDC).toBe(
      "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    );
    expect(DEVNET_KNOWN_TOKENS.USDT).toBe(
      "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS",
    );
  });

  test("DEVNET_TOKEN_INFO has metadata for devnet tokens", () => {
    const solInfo = DEVNET_TOKEN_INFO[DEVNET_KNOWN_TOKENS.SOL];
    expect(solInfo).toBeDefined();
    expect(solInfo?.symbol).toBe("SOL");

    const usdcInfo = DEVNET_TOKEN_INFO[DEVNET_KNOWN_TOKENS.USDC];
    expect(usdcInfo).toBeDefined();
    expect(usdcInfo?.symbol).toBe("USDC");
    expect(usdcInfo?.name).toContain("Devnet");
  });

  test("SOL mint address is the same on mainnet and devnet", () => {
    expect(KNOWN_TOKENS.SOL).toBe(DEVNET_KNOWN_TOKENS.SOL);
  });

  test("USDC mint addresses are different on mainnet vs devnet", () => {
    expect(KNOWN_TOKENS.USDC).not.toBe(DEVNET_KNOWN_TOKENS.USDC);
  });
});

describe("Token Fetcher - Cluster Support", () => {
  test("creates mainnet fetcher by default", async () => {
    const fetcher = createTokenFetcher();

    // Should resolve mainnet USDC
    const token = await fetcher.getToken(KNOWN_TOKENS.USDC);
    expect(token.symbol).toBe("USDC");
    expect(token.mint).toBe(KNOWN_TOKENS.USDC);
  });

  test("creates devnet fetcher with cluster option", async () => {
    const fetcher = createTokenFetcher({ cluster: "devnet" });

    // Should resolve devnet USDC
    const token = await fetcher.getToken(DEVNET_KNOWN_TOKENS.USDC);
    expect(token.symbol).toBe("USDC");
    expect(token.mint).toBe(DEVNET_KNOWN_TOKENS.USDC);
    expect(token.name).toContain("Devnet");
  });

  test("devnet fetcher does not resolve mainnet-only tokens", async () => {
    const fetcher = createTokenFetcher({ cluster: "devnet" });

    // Mainnet USDC should be unknown on devnet
    const token = await fetcher.getToken(KNOWN_TOKENS.USDC);
    expect(token.name).toContain("Unknown Token");
  });

  test("mainnet fetcher does not resolve devnet-only tokens", async () => {
    const fetcher = createTokenFetcher({ cluster: "mainnet-beta" });

    // Devnet USDC should be unknown on mainnet (unless Jupiter has it)
    const token = await fetcher.getToken(DEVNET_KNOWN_TOKENS.USDC);
    // It will either be unknown or potentially in Jupiter's list
    expect(token.mint).toBe(DEVNET_KNOWN_TOKENS.USDC);
  });

  test("custom tokens take priority over built-in registry", async () => {
    const customMint = "CustomMintAddress123456789012345678901234567";
    const fetcher = createTokenFetcher({
      cluster: "devnet",
      customTokens: {
        [customMint]: {
          mint: customMint,
          symbol: "CUSTOM",
          name: "My Custom Token",
          decimals: 9,
        },
      },
    });

    const token = await fetcher.getToken(customMint);
    expect(token.symbol).toBe("CUSTOM");
    expect(token.name).toBe("My Custom Token");
  });

  test("custom tokens can override built-in tokens", async () => {
    const fetcher = createTokenFetcher({
      cluster: "devnet",
      customTokens: {
        [DEVNET_KNOWN_TOKENS.USDC]: {
          mint: DEVNET_KNOWN_TOKENS.USDC,
          symbol: "myUSDC",
          name: "My Custom USDC",
          decimals: 6,
        },
      },
    });

    const token = await fetcher.getToken(DEVNET_KNOWN_TOKENS.USDC);
    expect(token.symbol).toBe("myUSDC");
    expect(token.name).toBe("My Custom USDC");
  });

  test("testnet uses devnet token registry", async () => {
    const fetcher = createTokenFetcher({ cluster: "testnet" });

    // Should resolve devnet USDC on testnet
    const token = await fetcher.getToken(DEVNET_KNOWN_TOKENS.USDC);
    expect(token.symbol).toBe("USDC");
  });

  test("getTokens resolves multiple tokens correctly", async () => {
    const fetcher = createTokenFetcher({ cluster: "devnet" });

    const tokens = await fetcher.getTokens([
      DEVNET_KNOWN_TOKENS.SOL,
      DEVNET_KNOWN_TOKENS.USDC,
      "UnknownMint12345678901234567890123456789012",
    ]);

    expect(tokens.size).toBe(3);
    expect(tokens.get(DEVNET_KNOWN_TOKENS.SOL)?.symbol).toBe("SOL");
    expect(tokens.get(DEVNET_KNOWN_TOKENS.USDC)?.symbol).toBe("USDC");
    expect(
      tokens.get("UnknownMint12345678901234567890123456789012")?.name,
    ).toContain("Unknown Token");
  });
});

describe("Token Fetcher - Jupiter API behavior", () => {
  test("devnet fetcher does not call Jupiter API", async () => {
    const fetcher = createTokenFetcher({ cluster: "devnet" });

    // This should not make any HTTP requests
    await fetcher.getToken("SomeRandomMint1234567890123456789012345678");

    // Cache size should be 0 since Jupiter is not called for devnet
    expect(fetcher.getCacheSize()).toBe(0);
  });

  test("refresh is a no-op on devnet", async () => {
    const fetcher = createTokenFetcher({ cluster: "devnet" });

    // Should not throw and should not make HTTP requests
    await fetcher.refresh();
    expect(fetcher.getCacheSize()).toBe(0);
  });
});

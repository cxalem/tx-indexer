import type { TokenInfo } from "./money.types";

export const KNOWN_TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDC_BRIDGED: "A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM",
} as const;

export const TOKEN_INFO: Record<string, TokenInfo> = {
  [KNOWN_TOKENS.SOL]: {
    mint: KNOWN_TOKENS.SOL,
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  [KNOWN_TOKENS.USDC]: {
    mint: KNOWN_TOKENS.USDC,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  [KNOWN_TOKENS.USDC_BRIDGED]: {
    mint: KNOWN_TOKENS.USDC_BRIDGED,
    symbol: "USDCet",
    name: "USDC (Bridged)",
    decimals: 6,
  },
};

export function getTokenInfo(mint: string): TokenInfo | undefined {
  return TOKEN_INFO[mint];
}

export function isSupportedToken(mint: string): boolean {
  return mint in TOKEN_INFO;
}

export const SUPPORTED_STABLECOINS = [
  KNOWN_TOKENS.USDC,
  KNOWN_TOKENS.USDC_BRIDGED,
] as const;

export const TRACKED_TOKENS = [
  KNOWN_TOKENS.SOL,
  KNOWN_TOKENS.USDC,
] as const;


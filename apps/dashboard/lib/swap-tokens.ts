/**
 * Supported tokens for swap feature
 * Only these tokens are allowed for trading
 */

export interface SwapToken {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoUrl?: string;
}

// Native SOL uses this special mint address
export const SOL_MINT = "So11111111111111111111111111111111111111112";

export const SWAP_TOKENS: SwapToken[] = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: SOL_MINT,
    decimals: 9,
    logoUrl:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    logoUrl:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    logoUrl:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
  },
  {
    symbol: "USDG",
    name: "Global Dollar",
    mint: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
    decimals: 6,
    logoUrl:
      "https://img.fotofolio.xyz/?url=https%3A%2F%2Fbafkreiflz2xxkfn33qjch2wj55bvbn33q3s4mmb6bye5pt3mpgy4t2wg4e.ipfs.nftstorage.link",
  },
];

// Allowed pairs: USDC <-> USDG, USDC <-> USDT, SOL <-> USDC, SOL <-> USDT, SOL <-> USDG
// We define valid pairs as a set of sorted mint pairs for easy lookup
const VALID_PAIRS = new Set([
  // USDC <-> USDG
  [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
  ]
    .sort()
    .join("-"),
  // USDC <-> USDT
  [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  ]
    .sort()
    .join("-"),
  // SOL <-> USDC
  [SOL_MINT, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"].sort().join("-"),
  // SOL <-> USDT
  [SOL_MINT, "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"].sort().join("-"),
  // SOL <-> USDG
  [SOL_MINT, "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH"].sort().join("-"),
]);

/**
 * Check if a pair of tokens is a valid swap pair
 */
export function isValidSwapPair(mintA: string, mintB: string): boolean {
  if (mintA === mintB) return false;
  const pairKey = [mintA, mintB].sort().join("-");
  return VALID_PAIRS.has(pairKey);
}

/**
 * Get valid output tokens for a given input token
 */
export function getValidOutputTokens(inputMint: string): SwapToken[] {
  return SWAP_TOKENS.filter(
    (token) =>
      token.mint !== inputMint && isValidSwapPair(inputMint, token.mint),
  );
}

/**
 * Get token by mint address
 */
export function getTokenByMint(mint: string): SwapToken | undefined {
  return SWAP_TOKENS.find((token) => token.mint === mint);
}

/**
 * Get token by symbol
 */
export function getTokenBySymbol(symbol: string): SwapToken | undefined {
  return SWAP_TOKENS.find(
    (token) => token.symbol.toLowerCase() === symbol.toLowerCase(),
  );
}

/**
 * Convert UI amount to raw amount (with decimals)
 */
export function toRawAmount(uiAmount: number, decimals: number): bigint {
  return BigInt(Math.floor(uiAmount * Math.pow(10, decimals)));
}

/**
 * Convert raw amount to UI amount
 */
export function toUiAmount(
  rawAmount: bigint | number,
  decimals: number,
): number {
  return Number(rawAmount) / Math.pow(10, decimals);
}

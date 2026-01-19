import type { TokenInfo } from "./money.types";

/**
 * Well-known token mint addresses on Solana mainnet.
 * These are used as constants throughout the codebase.
 */
export const KNOWN_TOKENS = {
  // Native
  SOL: "So11111111111111111111111111111111111111112",

  // Stablecoins
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  PYUSD: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
  USDG: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
  USDC_BRIDGED: "A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM",
  DAI: "EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCCi3Z4dPuFhh",

  // Major tokens
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  RENDER: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
  HNT: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  MNGO: "MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac",
  MSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  JITOSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
  BSOL: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",

  // Memecoins
  POPCAT: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  MEW: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",
  PNUT: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump",
  FARTCOIN: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
  AI16Z: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC",

  // Wrapped tokens
  WBTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  WETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
  WSOL: "So11111111111111111111111111111111111111112", // Same as SOL (wrapped)
} as const;

/**
 * Static token metadata registry.
 * This serves as a fallback when external APIs (like Jupiter) are unavailable.
 *
 * Logo URLs are from:
 * - Solana Labs token list (legacy but still hosted)
 * - Jupiter token list CDN
 */
export const TOKEN_INFO: Record<string, TokenInfo> = {
  // Native SOL
  [KNOWN_TOKENS.SOL]: {
    mint: KNOWN_TOKENS.SOL,
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },

  // Stablecoins
  [KNOWN_TOKENS.USDC]: {
    mint: KNOWN_TOKENS.USDC,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },
  [KNOWN_TOKENS.USDT]: {
    mint: KNOWN_TOKENS.USDT,
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
  },
  [KNOWN_TOKENS.PYUSD]: {
    mint: KNOWN_TOKENS.PYUSD,
    symbol: "PYUSD",
    name: "PayPal USD",
    decimals: 6,
    logoURI:
      "https://img.fotofolio.xyz/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsolana-labs%2Ftoken-list%2Fmain%2Fassets%2Fmainnet%2F2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo%2Flogo.png",
  },
  [KNOWN_TOKENS.USDG]: {
    mint: KNOWN_TOKENS.USDG,
    symbol: "USDG",
    name: "USD Glitter",
    decimals: 6,
  },
  [KNOWN_TOKENS.USDC_BRIDGED]: {
    mint: KNOWN_TOKENS.USDC_BRIDGED,
    symbol: "USDCet",
    name: "USDC (Wormhole)",
    decimals: 6,
  },
  [KNOWN_TOKENS.DAI]: {
    mint: KNOWN_TOKENS.DAI,
    symbol: "DAI",
    name: "DAI (Wormhole)",
    decimals: 8,
  },

  // Major tokens
  [KNOWN_TOKENS.JUP]: {
    mint: KNOWN_TOKENS.JUP,
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    logoURI: "https://static.jup.ag/jup/icon.png",
  },
  [KNOWN_TOKENS.JTO]: {
    mint: KNOWN_TOKENS.JTO,
    symbol: "JTO",
    name: "Jito",
    decimals: 9,
    logoURI: "https://metadata.jito.network/token/jto/image",
  },
  [KNOWN_TOKENS.PYTH]: {
    mint: KNOWN_TOKENS.PYTH,
    symbol: "PYTH",
    name: "Pyth Network",
    decimals: 6,
    logoURI: "https://pyth.network/token.svg",
  },
  [KNOWN_TOKENS.BONK]: {
    mint: KNOWN_TOKENS.BONK,
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
  },
  [KNOWN_TOKENS.WIF]: {
    mint: KNOWN_TOKENS.WIF,
    symbol: "WIF",
    name: "dogwifhat",
    decimals: 6,
    logoURI:
      "https://bafkreibk3covs5ltyqxa272uodhber6kcclnlgrbwjee4kyqhstwmjqpfa.ipfs.nftstorage.link/",
  },
  [KNOWN_TOKENS.RENDER]: {
    mint: KNOWN_TOKENS.RENDER,
    symbol: "RENDER",
    name: "Render Token",
    decimals: 8,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof/logo.png",
  },
  [KNOWN_TOKENS.HNT]: {
    mint: KNOWN_TOKENS.HNT,
    symbol: "HNT",
    name: "Helium",
    decimals: 8,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux/logo.png",
  },
  [KNOWN_TOKENS.RAY]: {
    mint: KNOWN_TOKENS.RAY,
    symbol: "RAY",
    name: "Raydium",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
  },
  [KNOWN_TOKENS.ORCA]: {
    mint: KNOWN_TOKENS.ORCA,
    symbol: "ORCA",
    name: "Orca",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png",
  },
  [KNOWN_TOKENS.MNGO]: {
    mint: KNOWN_TOKENS.MNGO,
    symbol: "MNGO",
    name: "Mango",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac/logo.png",
  },

  // Liquid staking tokens
  [KNOWN_TOKENS.MSOL]: {
    mint: KNOWN_TOKENS.MSOL,
    symbol: "mSOL",
    name: "Marinade Staked SOL",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png",
  },
  [KNOWN_TOKENS.JITOSOL]: {
    mint: KNOWN_TOKENS.JITOSOL,
    symbol: "JitoSOL",
    name: "Jito Staked SOL",
    decimals: 9,
    logoURI: "https://storage.googleapis.com/token-metadata/JitoSOL-256.png",
  },
  [KNOWN_TOKENS.BSOL]: {
    mint: KNOWN_TOKENS.BSOL,
    symbol: "bSOL",
    name: "BlazeStake Staked SOL",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1/logo.png",
  },

  // Memecoins
  [KNOWN_TOKENS.POPCAT]: {
    mint: KNOWN_TOKENS.POPCAT,
    symbol: "POPCAT",
    name: "Popcat",
    decimals: 9,
    logoURI:
      "https://bafkreidvkvuzyslw5jh5z242lgzwzhbi2kxxnpkm73fkuqzasyr34jj2o4.ipfs.nftstorage.link/",
  },
  [KNOWN_TOKENS.MEW]: {
    mint: KNOWN_TOKENS.MEW,
    symbol: "MEW",
    name: "cat in a dogs world",
    decimals: 5,
    logoURI:
      "https://bafkreidlwyr565dxtao2ipsze6bmzpszqzybz7sqi2zaet5fs7k53henju.ipfs.nftstorage.link/",
  },
  [KNOWN_TOKENS.PNUT]: {
    mint: KNOWN_TOKENS.PNUT,
    symbol: "Peanut",
    name: "Peanut the Squirrel",
    decimals: 6,
    logoURI:
      "https://ipfs.io/ipfs/QmNS3Hdb6pMheFzRdwXr3PPCrXcBohzhLrKHqEUV1n3HnJ",
  },
  [KNOWN_TOKENS.FARTCOIN]: {
    mint: KNOWN_TOKENS.FARTCOIN,
    symbol: "FARTCOIN",
    name: "Fartcoin",
    decimals: 6,
    logoURI:
      "https://ipfs.io/ipfs/QmQHY6t8TxucH3F9LGPBBqqRLbyWx7NxWvrnoZKcq9ErrR",
  },
  [KNOWN_TOKENS.AI16Z]: {
    mint: KNOWN_TOKENS.AI16Z,
    symbol: "ai16z",
    name: "ai16z",
    decimals: 9,
    logoURI:
      "https://ipfs.io/ipfs/QmRbm1mprqHmJ7PvCTrSNydkquLi5r41wq8kWbHvoRm3FX",
  },

  // Wrapped tokens
  [KNOWN_TOKENS.WBTC]: {
    mint: KNOWN_TOKENS.WBTC,
    symbol: "WBTC",
    name: "Wrapped BTC (Wormhole)",
    decimals: 8,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png",
  },
  [KNOWN_TOKENS.WETH]: {
    mint: KNOWN_TOKENS.WETH,
    symbol: "WETH",
    name: "Wrapped ETH (Wormhole)",
    decimals: 8,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png",
  },
};

export function getTokenInfo(mint: string): TokenInfo | undefined {
  return TOKEN_INFO[mint];
}

export function isSupportedToken(mint: string): boolean {
  return mint in TOKEN_INFO;
}

/**
 * Creates an "unknown token" placeholder for tokens not in the registry.
 * Uses the first 8 characters of the mint address as a symbol.
 */
export function createUnknownToken(mint: string, decimals: number): TokenInfo {
  return {
    mint,
    symbol: mint.slice(0, 8),
    name: `Unknown Token (${mint.slice(0, 8)}...)`,
    decimals,
  };
}

export const SUPPORTED_STABLECOINS = [
  KNOWN_TOKENS.USDC,
  KNOWN_TOKENS.USDT,
  KNOWN_TOKENS.PYUSD,
  KNOWN_TOKENS.USDG,
  KNOWN_TOKENS.USDC_BRIDGED,
  KNOWN_TOKENS.DAI,
] as const;

export const TRACKED_TOKENS = [
  KNOWN_TOKENS.SOL,
  KNOWN_TOKENS.USDC,
  KNOWN_TOKENS.USDT,
] as const;

/**
 * Liquid staking tokens that represent staked SOL
 */
export const LIQUID_STAKING_TOKENS = [
  KNOWN_TOKENS.MSOL,
  KNOWN_TOKENS.JITOSOL,
  KNOWN_TOKENS.BSOL,
] as const;

// =============================================================================
// Devnet Token Registry
// =============================================================================

/**
 * Well-known token mint addresses on Solana devnet.
 * These are official devnet faucet tokens and popular test tokens.
 */
export const DEVNET_KNOWN_TOKENS = {
  // Native (same across all networks)
  SOL: "So11111111111111111111111111111111111111112",

  // Official SPL Token Faucet tokens (devnet)
  // https://spl-token-faucet.com/
  USDC: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  USDT: "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS",

  // Solana Program Library test tokens
  DUMMY: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",

  // Wrapped SOL (same across all networks)
  WSOL: "So11111111111111111111111111111111111111112",
} as const;

/**
 * Token metadata for devnet tokens.
 */
export const DEVNET_TOKEN_INFO: Record<string, TokenInfo> = {
  // Native SOL (same as mainnet)
  [DEVNET_KNOWN_TOKENS.SOL]: {
    mint: DEVNET_KNOWN_TOKENS.SOL,
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  },

  // Devnet USDC (from SPL Token Faucet)
  [DEVNET_KNOWN_TOKENS.USDC]: {
    mint: DEVNET_KNOWN_TOKENS.USDC,
    symbol: "USDC",
    name: "USD Coin (Devnet)",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
  },

  // Devnet USDT
  [DEVNET_KNOWN_TOKENS.USDT]: {
    mint: DEVNET_KNOWN_TOKENS.USDT,
    symbol: "USDT",
    name: "Tether USD (Devnet)",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
  },

  // Dummy test token
  [DEVNET_KNOWN_TOKENS.DUMMY]: {
    mint: DEVNET_KNOWN_TOKENS.DUMMY,
    symbol: "DUMMY",
    name: "Dummy Token (Devnet)",
    decimals: 9,
  },
};

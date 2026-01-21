/**
 * Privacy Protocol Constants
 *
 * Shared constants for privacy protocol integrations.
 *
 * =============================================================================
 * HACKATHON: Solana Privacy Hack 2026
 * =============================================================================
 */

// =============================================================================
// Privacy Cash Constants
// =============================================================================

/**
 * Privacy Cash Program IDs
 * Mainnet is the default for production use
 */
export const PRIVACY_CASH_PROGRAM_ID =
  "9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD";
export const PRIVACY_CASH_DEVNET_PROGRAM_ID =
  "ATZj4jZ4FFzkvAcvk27DW9GRkgSbFnHo49fKKPQXU7VS";

/**
 * Privacy Cash Admin Addresses
 */
export const PRIVACY_CASH_ADMIN =
  "AWexibGxNFKTa1b5R5MN4PJr9HWnWRwf8EW9g8cLx3dM";
export const PRIVACY_CASH_ALT = "HEN49U2ySJ85Vc78qprSW9y6mFDhs1NczRxyppNHjofe";

/**
 * Privacy Cash API Endpoint (for relayer)
 */
export const PRIVACY_CASH_API_URL = "https://api3.privacycash.org";

/**
 * Supported tokens for Privacy Cash
 */
export const PRIVACY_CASH_SUPPORTED_TOKENS = {
  SOL: {
    symbol: "SOL",
    decimals: 9,
    mint: null, // Native SOL
  },
  USDC: {
    symbol: "USDC",
    decimals: 6,
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  USDT: {
    symbol: "USDT",
    decimals: 6,
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  },
} as const;

export type PrivacyCashToken = keyof typeof PRIVACY_CASH_SUPPORTED_TOKENS;

// =============================================================================
// SilentSwap Constants
// =============================================================================

/**
 * SilentSwap Environment
 * Use STAGING for development, MAINNET for production
 */
export const SILENT_SWAP_ENVIRONMENT = {
  STAGING: "staging",
  MAINNET: "mainnet",
} as const;

export type SilentSwapEnvironment =
  (typeof SILENT_SWAP_ENVIRONMENT)[keyof typeof SILENT_SWAP_ENVIRONMENT];

/**
 * SilentSwap Solana Chain ID for CAIP formats
 */
export const SILENT_SWAP_SOLANA_CHAIN_ID =
  "solana:5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";

/**
 * SilentSwap Asset CAIP-19 formats
 */
export const SILENT_SWAP_ASSETS = {
  // Native SOL
  SOL: `${SILENT_SWAP_SOLANA_CHAIN_ID}/slip44:501`,
  // USDC SPL Token
  USDC: `${SILENT_SWAP_SOLANA_CHAIN_ID}/erc20:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`,
} as const;

// =============================================================================
// UI Constants
// =============================================================================

/**
 * Privacy operation labels for UI display
 */
export const PRIVACY_OPERATION_LABELS = {
  privacy_deposit: "Shield",
  privacy_withdraw: "Unshield",
  private_transfer: "Private Transfer",
  private_swap: "Private Swap",
} as const;

/**
 * Privacy operation descriptions for tooltips
 */
export const PRIVACY_OPERATION_DESCRIPTIONS = {
  privacy_deposit:
    "Move funds into a privacy pool. Your balance will be hidden from public view.",
  privacy_withdraw:
    "Move funds out of the privacy pool to any Solana address. The recipient cannot be linked to your deposit.",
  private_transfer:
    "Send funds privately within the shielded pool. Amount and recipient are hidden.",
  private_swap:
    "Swap tokens through privacy-preserving routes. Transaction path is obfuscated.",
} as const;

/**
 * Estimated ZK proof generation time in milliseconds
 * Used to show loading indicators
 */
export const ZK_PROOF_GENERATION_TIME_MS = 3000;

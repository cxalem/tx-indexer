export const PRIVACY_CASH_PROGRAM_ID =
  "9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD";

export const PRIVACY_CASH_DEVNET_PROGRAM_ID =
  "ATZj4jZ4FFzkvAcvk27DW9GRkgSbFnHo49fKKPQXU7VS";

export const PRIVACY_CASH_FEE_RECIPIENT =
  "AWexibGxNFKTa1b5R5MN4PJr9HWnWRwf8EW9g8cLx3dM";

export const PRIVACY_CASH_ALT_ADDRESS =
  "HEN49U2ySJ85Vc78qprSW9y6mFDhs1NczRxyppNHjofe";

export const PRIVACY_CASH_RELAYER_URL =
  process.env.NEXT_PUBLIC_PRIVACY_CASH_RELAYER_URL ??
  "https://api3.privacycash.org";

export const PRIVACY_CASH_CIRCUIT_URL =
  process.env.NEXT_PUBLIC_PRIVACY_CASH_CIRCUIT_URL ??
  "https://www.privacycash.org/circuit2";

export const PRIVACY_CASH_SIGN_MESSAGE = "Privacy Money account sign in";

export const PRIVACY_CASH_SUPPORTED_TOKENS = {
  SOL: {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    mint: null,
    minDeposit: 0.01,
    maxDeposit: 10,
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    minDeposit: 1,
    maxDeposit: 10000,
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    minDeposit: 1,
    maxDeposit: 10000,
  },
} as const;

export type PrivacyCashToken = keyof typeof PRIVACY_CASH_SUPPORTED_TOKENS;

export const PRIVACY_CASH_TOKEN_LIST = Object.keys(
  PRIVACY_CASH_SUPPORTED_TOKENS,
) as PrivacyCashToken[];

export const PRIVACY_OPERATION_LABELS = {
  shield: "Shield",
  unshield: "Unshield",
  private_transfer: "Private Transfer",
} as const;

export const PRIVACY_OPERATION_DESCRIPTIONS = {
  shield:
    "Move funds into a shielded pool. Your balance will be hidden from public view.",
  unshield:
    "Move funds out of the shielded pool to any Solana address. The recipient cannot be linked to your deposit.",
  private_transfer:
    "Send funds privately within the shielded pool. Amount and recipient are hidden.",
} as const;

export const ZK_PROOF_GENERATION_ESTIMATE_MS = 5000;
export const TRANSACTION_POLL_INTERVAL_MS = 2000;
export const TRANSACTION_POLL_MAX_ATTEMPTS = 30;

export const STORAGE_KEY_PRIVACY_ENABLED = "privacy-features-enabled";
export const STORAGE_KEY_UTXO_CACHE_PREFIX = "privacy-cash-utxos-";

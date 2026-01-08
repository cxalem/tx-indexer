/**
 * Jupiter API configuration and types
 */

// API Configuration
export const JUPITER_CONFIG = {
  baseUrl: "https://api.jup.ag/swap/v1",
  endpoints: {
    quote: "/quote",
    swap: "/swap",
  },
  defaultSlippageBps: 50,
  maxPriorityFeeLamports: 1_000_000, // 0.001 SOL
  quoteExpirationMs: 30_000, // 30 seconds
} as const;

// Quote Response from Jupiter API
export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  priceImpactPct: string;
  routePlan: JupiterRoutePlan[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterRoutePlan {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

// Swap Response from Jupiter API
export interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

// Error response
export interface JupiterErrorResponse {
  error: string;
}

/**
 * Check if a quote is still valid (not expired)
 */
export function isQuoteValid(quoteTimestamp: number): boolean {
  return Date.now() - quoteTimestamp < JUPITER_CONFIG.quoteExpirationMs;
}

/**
 * Get time remaining until quote expires (in seconds)
 */
export function getQuoteTimeRemaining(quoteTimestamp: number): number {
  const remaining =
    JUPITER_CONFIG.quoteExpirationMs - (Date.now() - quoteTimestamp);
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * Parse error response from Jupiter API
 */
export function parseJupiterError(text: string): string {
  try {
    const data = JSON.parse(text) as JupiterErrorResponse;
    return data.error || text;
  } catch {
    return text || "Unknown error";
  }
}

/**
 * Validate Solana address format (basic check)
 */
export function isValidSolanaAddress(address: string): boolean {
  // Base58 characters only, 32-44 characters long
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/**
 * Validate swap amount
 */
export function isValidSwapAmount(amount: string): boolean {
  const num = parseInt(amount, 10);
  return !isNaN(num) && num > 0 && Number.isFinite(num);
}

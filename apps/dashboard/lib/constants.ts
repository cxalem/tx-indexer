/**
 * Shared constants for the dashboard application
 */

// =============================================================================
// POLLING & REFRESH INTERVALS
// =============================================================================

/** Standard polling interval for balance/transaction updates (ms) */
export const STANDARD_POLLING_INTERVAL_MS = 60 * 1000; // 60 seconds

/** Fast polling interval after a transaction (ms) */
export const FAST_POLLING_INTERVAL_MS = 10 * 1000; // 10 seconds

/** Duration to keep fast polling active after a transaction (ms) */
export const FAST_POLLING_DURATION_MS = 30 * 1000; // 30 seconds

/** Standard stale time for React Query (ms) */
export const STANDARD_STALE_TIME_MS = 30 * 1000; // 30 seconds

/** Fast stale time during fast polling (ms) */
export const FAST_STALE_TIME_MS = 5 * 1000; // 5 seconds

/** Long stale time for transaction feed (ms) - transactions are immutable */
export const TRANSACTION_FEED_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes

/** Server-side transaction cache TTL (ms) */
export const TRANSACTION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// =============================================================================
// STATEMENT & TRANSACTION LIMITS
// =============================================================================

/** Number of days to show in the transaction statement */
export const STATEMENT_WINDOW_DAYS = 31;

/** Statement window in milliseconds */
export const STATEMENT_WINDOW_MS = STATEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Number of days to show in watch mode (shorter for lighter load) */
export const WATCH_STATEMENT_WINDOW_DAYS = 15;

/** Watch mode statement window in milliseconds */
export const WATCH_STATEMENT_WINDOW_MS =
  WATCH_STATEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Default number of transactions to fetch per page */
export const DEFAULT_PAGE_SIZE = 10;

/** Default transaction limit for dashboard view */
export const DEFAULT_TRANSACTION_LIMIT = 10;

// =============================================================================
// PRICE CACHING
// =============================================================================

/** How long to cache token prices (ms) - prices don't change rapidly */
export const PRICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Jupiter price API revalidation interval (seconds) */
export const PRICE_REVALIDATE_SECONDS = 60;

// =============================================================================
// ANIMATION DURATIONS
// =============================================================================

/** Duration for "new transaction" highlight animation (ms) */
export const NEW_TRANSACTION_HIGHLIGHT_DURATION_MS = 3000;

// =============================================================================
// TOKEN ADDRESSES
// =============================================================================

/** USDC mint address on Solana mainnet */
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** SOL mint address (wrapped SOL) */
export const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Set of token mints that support sending */
export const SENDABLE_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "So11111111111111111111111111111111111111112", // SOL
]);

/** Set of stablecoin mint addresses */
export const STABLECOIN_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
  "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH", // USDG
  "A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM", // USDC Bridged
  "EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCCi3Z4dPuFhh", // DAI
]);

// =============================================================================
// QUERY KEYS (stable references)
// =============================================================================

/** Empty query key for disabled queries - stable reference to prevent re-renders */
export const EMPTY_DASHBOARD_QUERY_KEY = ["dashboard", "empty"] as const;

/** Empty query key for transactions feed - stable reference */
export const EMPTY_TRANSACTIONS_FEED_QUERY_KEY = [
  "transactions-feed",
  "empty",
] as const;

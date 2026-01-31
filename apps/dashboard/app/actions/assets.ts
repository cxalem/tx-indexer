"use server";

import { SOL_MINT } from "@/lib/constants";
import { fetchTokenPrices } from "@/lib/prices";

export interface TokenPriceData {
  mint: string;
  price: number | null;
  priceChange24h: number | null;
  priceHistory: PricePoint[];
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

export type Timeframe = "24h" | "7d" | "30d";

// =============================================================================
// COINGECKO API CONFIGURATION
// =============================================================================

const COINGECKO_API = "https://api.coingecko.com/api/v3";

function getApiKey(): string | undefined {
  return process.env.COINGECKO_API_KEY;
}

function getHeaders(): HeadersInit {
  const apiKey = getApiKey();
  const headers: HeadersInit = {
    Accept: "application/json",
  };
  if (apiKey) {
    headers["x-cg-demo-api-key"] = apiKey;
  }
  return headers;
}

// =============================================================================
// MINT TO COINGECKO ID MAPPING
// =============================================================================

/**
 * Mapping of Solana mint addresses to CoinGecko coin IDs
 * This is required because CoinGecko's historical chart API uses coin IDs, not contract addresses
 */
const MINT_TO_COINGECKO_ID: Record<string, string> = {
  // Native
  So11111111111111111111111111111111111111112: "solana",

  // Stablecoins
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "usd-coin",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "tether",
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo": "paypal-usd",
  "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH": "global-dollar",

  // Major tokens
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "jupiter-exchange-solana",
  jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL: "jito-governance-token",
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: "pyth-network",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "bonk",
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: "dogwifcoin",
  rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof: "render-token",
  hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux: "helium",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "raydium",
  orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE: "orca",

  // Liquid staking
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: "msol",
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: "jito-staked-sol",
  bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1: "blazestake-staked-sol",

  // Memecoins
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr": "popcat",
  MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5: "cat-in-a-dogs-world",
  "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump": "peanut-the-squirrel",
  "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump": "fartcoin",
  HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC: "ai16z",
};

function getCoinGeckoId(mint: string): string | null {
  return MINT_TO_COINGECKO_ID[mint] ?? null;
}

// =============================================================================
// CACHING
// =============================================================================

const priceHistoryCache = new Map<
  string,
  { data: PricePoint[]; timestamp: number; timeframe: Timeframe }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(mint: string, timeframe: Timeframe): string {
  return `${mint}:${timeframe}`;
}

// =============================================================================
// COINGECKO API FUNCTIONS
// =============================================================================

/**
 * Fetch current prices and 24h change for multiple tokens using contract addresses
 * Uses CoinGecko's /simple/token_price/solana endpoint
 */
async function fetchTokenPricesFromCoinGecko(
  mints: string[],
): Promise<Map<string, { price: number; change24h: number | null }>> {
  const result = new Map<string, { price: number; change24h: number | null }>();

  if (mints.length === 0 || !getApiKey()) {
    return result;
  }

  try {
    // CoinGecko allows comma-separated contract addresses
    const contractAddresses = mints.join(",");
    const url = `${COINGECKO_API}/simple/token_price/solana?contract_addresses=${contractAddresses}&vs_currencies=usd&include_24hr_change=true`;

    const response = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 60 }, // 1 min cache
    });

    if (!response.ok) {
      console.warn(`[CoinGecko] Token price API returned ${response.status}`);
      return result;
    }

    const data = await response.json();

    // Response format: { "mint_address": { "usd": 123.45, "usd_24h_change": 1.23 } }
    // CoinGecko returns addresses in lowercase
    for (const mint of mints) {
      const mintLower = mint.toLowerCase();
      const priceData = data[mintLower];
      if (priceData?.usd !== undefined) {
        result.set(mint, {
          price: priceData.usd,
          change24h: priceData.usd_24h_change ?? null,
        });
      }
    }
  } catch (error) {
    console.error("[CoinGecko] Failed to fetch token prices:", error);
  }

  return result;
}

/**
 * Convert timeframe to CoinGecko days parameter
 */
function timeframeToDays(timeframe: Timeframe): string {
  switch (timeframe) {
    case "24h":
      return "1";
    case "7d":
      return "7";
    case "30d":
      return "30";
  }
}

/**
 * Fetch price history for a token from CoinGecko
 * Uses CoinGecko's /coins/{id}/market_chart endpoint
 */
async function fetchPriceHistoryFromCoinGecko(
  mint: string,
  timeframe: Timeframe,
): Promise<PricePoint[]> {
  const cacheKey = getCacheKey(mint, timeframe);
  const cached = priceHistoryCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const coinId = getCoinGeckoId(mint);
  if (!coinId || !getApiKey()) {
    return [];
  }

  try {
    const days = timeframeToDays(timeframe);
    const url = `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;

    const response = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 300 }, // 5 min cache
    });

    if (!response.ok) {
      console.warn(
        `[CoinGecko] Market chart API returned ${response.status} for ${coinId}`,
      );
      return [];
    }

    const data = await response.json();

    if (!data.prices || !Array.isArray(data.prices)) {
      return [];
    }

    // Response format: { prices: [[timestamp, price], ...] }
    const priceHistory: PricePoint[] = data.prices.map(
      ([timestamp, price]: [number, number]) => ({
        timestamp,
        price,
      }),
    );

    // Cache the result
    priceHistoryCache.set(cacheKey, {
      data: priceHistory,
      timestamp: Date.now(),
      timeframe,
    });

    return priceHistory;
  } catch (error) {
    console.error(
      `[CoinGecko] Failed to fetch price history for ${mint}:`,
      error,
    );
    return [];
  }
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * Fetch price data for multiple tokens including current price, 24h change, and history
 *
 * Uses a hybrid approach:
 * - Jupiter for current prices (works for all Solana tokens)
 * - CoinGecko for 24h change and price history (only for mapped tokens)
 */
export async function getTokenPriceData(
  mints: string[],
  timeframe: Timeframe = "24h",
): Promise<Map<string, TokenPriceData>> {
  const result = new Map<string, TokenPriceData>();

  if (mints.length === 0) {
    return result;
  }

  // Fetch current prices from Jupiter (works for all tokens)
  const jupiterPrices = await fetchTokenPrices(mints);

  // Fetch 24h change from CoinGecko (only for tokens with coverage)
  const coinGeckoPrices = await fetchTokenPricesFromCoinGecko(mints);

  // Fetch price history for tokens that have CoinGecko ID mapping
  const historyPromises = mints.map(async (mint) => {
    const priceHistory = await fetchPriceHistoryFromCoinGecko(mint, timeframe);
    const cgData = coinGeckoPrices.get(mint);

    return {
      mint,
      // Use Jupiter price (more reliable, covers all tokens)
      price: jupiterPrices.get(mint) ?? null,
      // Use CoinGecko for 24h change (only available for some tokens)
      priceChange24h: cgData?.change24h ?? null,
      priceHistory,
    };
  });

  const priceDataArray = await Promise.all(historyPromises);

  for (const data of priceDataArray) {
    result.set(data.mint, data);
  }

  return result;
}

/**
 * Fetch price history for a single token
 */
export async function getTokenPriceHistory(
  mint: string,
  timeframe: Timeframe,
): Promise<PricePoint[]> {
  return fetchPriceHistoryFromCoinGecko(mint, timeframe);
}

/**
 * Get portfolio value history
 * Uses SOL price as a proxy for overall portfolio movement
 */
export async function getPortfolioValueHistory(
  timeframe: Timeframe = "7d",
): Promise<PricePoint[]> {
  return fetchPriceHistoryFromCoinGecko(SOL_MINT, timeframe);
}

/**
 * Check if a token has chart data available
 */
export async function hasChartDataAvailable(mint: string): Promise<boolean> {
  return getCoinGeckoId(mint) !== null;
}

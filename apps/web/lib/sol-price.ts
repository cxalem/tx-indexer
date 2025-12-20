// Jupiter lite API - free, no API key required
const JUPITER_PRICE_URL = "https://lite-api.jup.ag/price/v3/price";
const SOL_MINT = "So11111111111111111111111111111111111111112";

interface JupiterPriceResponse {
  [mint: string]: {
    createdAt: string;
    liquidity: number;
    usdPrice: number;
    blockId: number;
    decimals: number;
    priceChange24h: number;
  };
}

/**
 * Fetches the current SOL price in USD from Jupiter's free API.
 * @returns SOL price in USD, or null if the request fails
 */
export async function getSolPrice(): Promise<number | null> {
  try {
    const res = await fetch(`${JUPITER_PRICE_URL}?ids=${SOL_MINT}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!res.ok) {
      console.error("Failed to fetch SOL price:", res.status);
      return null;
    }

    const data: JupiterPriceResponse = await res.json();
    return data[SOL_MINT]?.usdPrice ?? null;
  } catch (error) {
    console.error("Error fetching SOL price:", error);
    return null;
  }
}

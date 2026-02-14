export interface NftMetadata {
  mint: string;
  name: string;
  symbol: string;
  image: string;
  cdnImage?: string;
  description?: string;
  collection?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

interface DasAssetResponse {
  jsonrpc: string;
  result?: {
    id: string;
    content: {
      metadata: {
        name: string;
        symbol: string;
        description?: string;
        attributes?: Array<{ trait_type: string; value: string }>;
      };
      links: {
        image?: string;
      };
      files?: Array<{
        uri: string;
        cdn_uri?: string;
        mime: string;
      }>;
    };
    grouping?: Array<{
      group_key: string;
      group_value: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

const NFT_FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches NFT metadata from Helius DAS API.
 *
 * @param rpcUrl - Helius RPC endpoint URL
 * @param mintAddress - NFT mint address
 * @returns NFT metadata including name, image, collection, and attributes, or null if not found
 */
export async function fetchNftMetadata(
  rpcUrl: string,
  mintAddress: string,
): Promise<NftMetadata | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NFT_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "get-asset",
        method: "getAsset",
        params: { id: mintAddress },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`DAS request failed with status ${response.status}`);
  }

  const data = (await response.json()) as DasAssetResponse;

  if (data.error || !data.result?.content?.metadata) {
    return null;
  }

  const { result } = data;
  const { content, grouping } = result;

  return {
    mint: mintAddress,
    name: content.metadata.name,
    symbol: content.metadata.symbol,
    image: content.links.image ?? content.files?.[0]?.uri ?? "",
    cdnImage: content.files?.[0]?.cdn_uri,
    description: content.metadata.description,
    collection: grouping?.find((g) => g.group_key === "collection")
      ?.group_value,
    attributes: content.metadata.attributes,
  };
}

/**
 * Fetches NFT metadata for multiple mints in parallel.
 *
 * @param rpcUrl - Helius RPC endpoint URL
 * @param mintAddresses - Array of NFT mint addresses
 * @returns Map of mint address to NFT metadata (only includes successful fetches)
 */
export async function fetchNftMetadataBatch(
  rpcUrl: string,
  mintAddresses: string[],
): Promise<Map<string, NftMetadata>> {
  if (mintAddresses.length === 0) {
    return new Map();
  }

  const results = await Promise.allSettled(
    mintAddresses.map((mint) => fetchNftMetadata(rpcUrl, mint)),
  );

  const map = new Map<string, NftMetadata>();
  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      map.set(mintAddresses[index]!, result.value);
    }
  });

  return map;
}

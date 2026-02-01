/**
 * Script to check token metadata resolution for a wallet.
 *
 * Usage:
 *   npx tsx scripts/check-token-metadata.ts <wallet_address>
 *
 * Example:
 *   npx tsx scripts/check-token-metadata.ts BBDCofEZCJ3mWhJeqSAbwkfYyLELUAnue1xjR5rCfpYq
 *
 * This script:
 * 1. Fetches all token mints from the wallet
 * 2. Resolves metadata via Jupiter "all" list
 * 3. Resolves missing via Helius DAS (Metaplex on-chain)
 * 4. Reports which source resolved each token
 */

import { createSolanaRpc, address } from "@solana/kit";

// Types
interface TokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  source: "static" | "jupiter" | "helius" | "fallback";
}

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface HeliusDasAsset {
  id: string;
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
    };
    links?: {
      image?: string;
    };
    files?: Array<{
      uri?: string;
      cdn_uri?: string;
    }>;
  };
  token_info?: {
    decimals?: number;
    symbol?: string;
  };
}

// Static known tokens (subset for testing)
const KNOWN_TOKENS: Record<string, TokenMetadata> = {
  So11111111111111111111111111111111111111112: {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    source: "static",
  },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    source: "static",
  },
};
// Jupiter token list - cached endpoint (no auth required)
const JUPITER_ALL_URL = "https://cache.jup.ag/tokens";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

async function fetchWalletTokens(
  rpcUrl: string,
  walletAddress: string,
): Promise<Array<{ mint: string; decimals: number; amount: number }>> {
  const rpc = createSolanaRpc(rpcUrl);
  const tokens: Array<{ mint: string; decimals: number; amount: number }> = [];

  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const response = await rpc
        .getTokenAccountsByOwner(
          address(walletAddress),
          { programId: address(programId) },
          { encoding: "jsonParsed" },
        )
        .send();

      for (const account of response.value) {
        const info = account.account.data.parsed.info;
        const amount = parseFloat(info.tokenAmount.uiAmountString || "0");

        // Only include tokens with non-zero balance
        if (amount > 0) {
          tokens.push({
            mint: info.mint,
            decimals: info.tokenAmount.decimals,
            amount,
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch ${programId} accounts:`, error);
    }
  }

  return tokens;
}

async function loadJupiterTokens(): Promise<Map<string, TokenMetadata>> {
  console.log("📥 Loading Jupiter token list (all)...");

  const response = await fetch(JUPITER_ALL_URL);
  if (!response.ok) {
    throw new Error(`Jupiter API returned ${response.status}`);
  }

  const tokens = (await response.json()) as JupiterToken[];
  const map = new Map<string, TokenMetadata>();

  for (const token of tokens) {
    map.set(token.address, {
      mint: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI,
      source: "jupiter",
    });
  }

  console.log(`✅ Loaded ${tokens.length} tokens from Jupiter`);
  return map;
}

async function fetchHeliusMetadata(
  rpcUrl: string,
  mints: string[],
): Promise<Map<string, TokenMetadata>> {
  console.log(`📥 Fetching Helius DAS metadata for ${mints.length} tokens...`);

  const results = new Map<string, TokenMetadata>();

  if (mints.length === 0) {
    return results;
  }

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "get-asset-batch",
        method: "getAssetBatch",
        params: {
          ids: mints,
        },
      }),
    });

    if (!response.ok) {
      console.warn(`Helius DAS returned ${response.status}`);
      return results;
    }

    const data = await response.json();

    if (data.error) {
      console.warn("Helius DAS error:", data.error);
      return results;
    }

    const assets = (data.result || []) as HeliusDasAsset[];

    for (const asset of assets) {
      if (!asset || !asset.id) continue;

      const metadata = asset.content?.metadata;
      const tokenInfo = asset.token_info;
      const links = asset.content?.links;
      const files = asset.content?.files;

      const logoURI =
        links?.image || files?.[0]?.cdn_uri || files?.[0]?.uri || undefined;

      const symbol =
        tokenInfo?.symbol || metadata?.symbol || asset.id.slice(0, 6);
      const name = metadata?.name || `Token ${asset.id.slice(0, 8)}...`;
      const decimals = tokenInfo?.decimals ?? 9;

      results.set(asset.id, {
        mint: asset.id,
        symbol,
        name,
        decimals,
        logoURI,
        source: "helius",
      });
    }

    console.log(
      `✅ Resolved ${results.size}/${mints.length} tokens from Helius DAS`,
    );
  } catch (error) {
    console.warn("Helius DAS fetch failed:", error);
  }

  return results;
}

async function main() {
  const walletAddress = process.argv[2];

  if (!walletAddress) {
    console.error(
      "Usage: npx tsx scripts/check-token-metadata.ts <wallet_address>",
    );
    process.exit(1);
  }

  const rpcUrl = process.env.SERVER_RPC_URL;
  if (!rpcUrl) {
    console.error("SERVER_RPC_URL environment variable is not set");
    process.exit(1);
  }

  console.log(`\n🔍 Checking token metadata for wallet: ${walletAddress}\n`);
  console.log("=".repeat(80));

  // 1. Fetch wallet tokens
  console.log("\n📊 Fetching wallet tokens...");
  const walletTokens = await fetchWalletTokens(rpcUrl, walletAddress);
  console.log(`Found ${walletTokens.length} tokens with non-zero balance\n`);

  if (walletTokens.length === 0) {
    console.log("No tokens found in wallet.");
    return;
  }

  // 2. Load Jupiter token list
  const jupiterTokens = await loadJupiterTokens();

  // 3. Resolve metadata
  const results: Array<{
    mint: string;
    amount: number;
    metadata: TokenMetadata | null;
  }> = [];

  const missingAfterJupiter: string[] = [];

  for (const token of walletTokens) {
    // Check static first
    if (KNOWN_TOKENS[token.mint]) {
      results.push({
        mint: token.mint,
        amount: token.amount,
        metadata: KNOWN_TOKENS[token.mint]!,
      });
      continue;
    }

    // Check Jupiter
    const jupiterInfo = jupiterTokens.get(token.mint);
    if (jupiterInfo) {
      results.push({
        mint: token.mint,
        amount: token.amount,
        metadata: jupiterInfo,
      });
      continue;
    }

    // Mark as missing
    missingAfterJupiter.push(token.mint);
    results.push({
      mint: token.mint,
      amount: token.amount,
      metadata: null, // Will be filled by Helius
    });
  }

  // 4. Fetch Helius DAS for missing
  if (missingAfterJupiter.length > 0) {
    const heliusResults = await fetchHeliusMetadata(
      rpcUrl,
      missingAfterJupiter,
    );

    for (const result of results) {
      if (!result.metadata) {
        const heliusInfo = heliusResults.get(result.mint);
        if (heliusInfo) {
          result.metadata = heliusInfo;
        } else {
          // Fallback
          result.metadata = {
            mint: result.mint,
            symbol: result.mint.slice(0, 6),
            name: `Unknown Token (${result.mint.slice(0, 8)}...)`,
            decimals: 9,
            source: "fallback",
          };
        }
      }
    }
  }

  // 5. Print results
  console.log("\n" + "=".repeat(80));
  console.log("\n📋 METADATA RESOLUTION RESULTS\n");

  const bySource = {
    static: 0,
    jupiter: 0,
    helius: 0,
    fallback: 0,
  };

  console.log(
    "%-44s %-10s %-20s %-10s".replace(/%/g, ""),
    "MINT",
    "SOURCE",
    "SYMBOL",
    "NAME",
  );
  console.log("-".repeat(80));

  for (const result of results) {
    const meta = result.metadata!;
    bySource[meta.source]++;

    const sourceEmoji = {
      static: "📦",
      jupiter: "🪐",
      helius: "🌐",
      fallback: "❓",
    }[meta.source];

    console.log(
      `${result.mint.slice(0, 8)}... ${sourceEmoji} ${meta.source.padEnd(8)} ${meta.symbol.slice(0, 15).padEnd(15)} ${meta.name.slice(0, 30)}`,
    );
  }

  // 6. Summary
  console.log("\n" + "=".repeat(80));
  console.log("\n📊 SUMMARY\n");
  console.log(`Total tokens:    ${walletTokens.length}`);
  console.log(
    `Static registry: ${bySource.static} (${((bySource.static / walletTokens.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Jupiter list:    ${bySource.jupiter} (${((bySource.jupiter / walletTokens.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Helius DAS:      ${bySource.helius} (${((bySource.helius / walletTokens.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Fallback:        ${bySource.fallback} (${((bySource.fallback / walletTokens.length) * 100).toFixed(1)}%)`,
  );

  const resolvedCount = walletTokens.length - bySource.fallback;
  console.log(
    `\n✅ Successfully resolved: ${resolvedCount}/${walletTokens.length} (${((resolvedCount / walletTokens.length) * 100).toFixed(1)}%)`,
  );

  if (bySource.fallback > 0) {
    console.log("\n⚠️  Tokens that couldn't be resolved:");
    for (const result of results) {
      if (result.metadata?.source === "fallback") {
        console.log(`   - ${result.mint}`);
      }
    }
  }
}

main().catch(console.error);

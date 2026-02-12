import { z } from "zod";
import { withRetry, type RetryConfig } from "@tx-indexer/solana/rpc/retry";
import {
  ConfigurationError,
  InvalidInputError,
  NetworkError,
  RateLimitError,
  RpcError,
  TxIndexerError,
} from "./errors";

export const DEFAULT_HELIUS_WALLET_API_BASE_URL = "https://api.helius.xyz/v1";

const DEFAULT_TIMEOUT_MS = 10_000;

const WalletFundingSourceSchema = z.object({
  funder: z.string(),
  funderName: z.string().nullable(),
  funderType: z.string().nullable(),
  mint: z.string(),
  symbol: z.string(),
  amount: z.number(),
  amountRaw: z.string(),
  decimals: z.number(),
  date: z.string(),
  signature: z.string(),
  timestamp: z.number(),
  slot: z.number(),
  explorerUrl: z.string(),
});

export type WalletFundingSource = z.infer<typeof WalletFundingSourceSchema>;

export interface FetchWalletFundingSourceOptions {
  walletAddress: string;
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  retry?: RetryConfig;
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function buildFundedByUrl(
  baseUrl: string,
  walletAddress: string,
  apiKey: string,
): string {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);
  const encodedAddress = encodeURIComponent(walletAddress);
  const encodedApiKey = encodeURIComponent(apiKey);
  return `${normalizedBaseUrl}/wallet/${encodedAddress}/funded-by?api-key=${encodedApiKey}`;
}

function toStatusMessage(
  status: number,
  body: string,
  fallback: string,
): string {
  return body.trim().length > 0 ? body : fallback || `HTTP ${status}`;
}

export async function fetchWalletFundingSource(
  options: FetchWalletFundingSourceOptions,
): Promise<WalletFundingSource | null> {
  const {
    walletAddress,
    apiKey,
    baseUrl = DEFAULT_HELIUS_WALLET_API_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retry,
  } = options;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new ConfigurationError("Helius API key is required.");
  }

  const url = buildFundedByUrl(baseUrl, walletAddress, apiKey);

  const request = async (): Promise<WalletFundingSource | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const message = toStatusMessage(
          response.status,
          body,
          response.statusText,
        );

        if (response.status === 400) {
          throw new InvalidInputError(`Invalid wallet address: ${message}`, {
            field: "walletAddress",
            value: walletAddress,
          });
        }

        if (response.status === 401 || response.status === 403) {
          throw new ConfigurationError(
            `Helius Wallet API authentication failed (${response.status}): ${message}`,
          );
        }

        if (response.status === 429) {
          throw new RateLimitError(
            `Helius Wallet API rate limit exceeded (${response.status}): ${message}`,
          );
        }

        throw new RpcError(
          `Helius Wallet API request failed (${response.status}): ${message}`,
          {
            statusCode: response.status,
            method: "GET /wallet/:address/funded-by",
            retryable: response.status >= 500,
          },
        );
      }

      const data = await response.json();
      const parsed = WalletFundingSourceSchema.safeParse(data);

      if (!parsed.success) {
        throw new RpcError(
          "Helius Wallet API returned an unexpected funded-by response shape.",
          {
            method: "GET /wallet/:address/funded-by",
            retryable: false,
          },
        );
      }

      return parsed.data;
    } catch (error) {
      if (error instanceof TxIndexerError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new NetworkError(
          `Network timeout while fetching wallet funding source (timeout: ${timeoutMs}ms).`,
          { cause: error },
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new NetworkError(`Network request failed: ${message}`, {
        cause: error instanceof Error ? error : undefined,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return withRetry(request, retry);
}

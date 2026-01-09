/**
 * JSON-RPC Batch Request Support
 *
 * Implements batching for Solana RPC calls to reduce HTTP request overhead.
 * Instead of N individual HTTP requests, batches them into ceil(N/batchSize) requests.
 */

import type { Signature } from "@solana/kit";
import type { RawTransaction } from "@tx-indexer/core/tx/tx.types";
import { withRetry, type RetryConfig } from "./retry";

export interface BatchConfig {
  /** Max number of RPC calls per HTTP request (default: 10) */
  batchSize?: number;
  /** Commitment level (default: "confirmed") */
  commitment?: "confirmed" | "finalized";
  /** Retry configuration for rate limits */
  retry?: RetryConfig;
  /**
   * Target requests per second to stay under rate limits.
   * Set to 0 to disable throttling. Default: 10 (Helius free tier)
   */
  requestsPerSecond?: number;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  programId?: string;
  uiTokenAmount: {
    amount: string;
    decimals: number;
    uiAmountString: string;
  };
}

interface GetTransactionResponse {
  slot: number | bigint;
  blockTime: number | bigint | null;
  meta: {
    fee: number | bigint;
    err: unknown | null;
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
    preBalances?: Array<number | bigint>;
    postBalances?: Array<number | bigint>;
    logMessages?: string[];
  } | null;
  transaction: {
    message: {
      accountKeys: Array<string | { pubkey: string }>;
      instructions: Array<{
        programIdIndex: number;
        accounts?: number[];
        data?: string;
      }>;
    };
    signatures: string[];
  };
}

async function sendBatchRequest<T>(
  rpcUrl: string,
  requests: JsonRpcRequest[],
  retry?: RetryConfig,
): Promise<Array<JsonRpcResponse<T>>> {
  const doFetch = async (): Promise<Array<JsonRpcResponse<T>>> => {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requests),
    });

    // Handle HTTP-level errors
    if (!response.ok) {
      const text = await response.text();
      // 403 means batching not supported (e.g., Helius free tier)
      if (response.status === 403) {
        throw new Error(`BATCH_NOT_SUPPORTED: ${text}`);
      }
      // 429 means rate limited - retry logic can handle this
      if (response.status === 429) {
        throw new Error(`429 Too Many Requests: ${text}`);
      }
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const json = await response.json();
    return json as Array<JsonRpcResponse<T>>;
  };

  // Use retry with more aggressive settings for batch requests
  const batchRetry: RetryConfig = {
    maxAttempts: retry?.maxAttempts ?? 5,
    baseDelayMs: retry?.baseDelayMs ?? 2000,
    maxDelayMs: retry?.maxDelayMs ?? 30000,
  };

  return withRetry(doFetch, batchRetry);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function extractProgramIdsFromMessage(
  message: GetTransactionResponse["transaction"]["message"],
): string[] {
  const accountKeys = message.accountKeys.map((key) =>
    typeof key === "string" ? key : key.pubkey,
  );

  const programIds = new Set<string>();
  for (const instruction of message.instructions) {
    const programId = accountKeys[instruction.programIdIndex];
    if (programId) {
      programIds.add(programId);
    }
  }
  return Array.from(programIds);
}

function extractMemoFromLogs(logMessages?: string[]): string | null {
  if (!logMessages) return null;

  for (const log of logMessages) {
    if (log.includes("Program log: Memo")) {
      const match = log.match(/Memo \(len \d+\): "(.+)"/);
      if (match) return match[1] ?? null;
    }
  }
  return null;
}

function responseToRawTransaction(
  sig: string,
  resp: GetTransactionResponse | null,
): RawTransaction | null {
  if (!resp) {
    return null;
  }

  const memo = extractMemoFromLogs(resp.meta?.logMessages);
  const accountKeys = resp.transaction.message.accountKeys.map((key) =>
    typeof key === "string" ? key : key.pubkey,
  );

  const preTokenBalances = (resp.meta?.preTokenBalances ?? []).map((bal) => ({
    accountIndex: bal.accountIndex,
    mint: bal.mint,
    owner: bal.owner,
    programId: bal.programId,
    uiTokenAmount: {
      amount: bal.uiTokenAmount.amount,
      decimals: bal.uiTokenAmount.decimals,
      uiAmountString: bal.uiTokenAmount.uiAmountString,
    },
  }));

  const postTokenBalances = (resp.meta?.postTokenBalances ?? []).map((bal) => ({
    accountIndex: bal.accountIndex,
    mint: bal.mint,
    owner: bal.owner,
    programId: bal.programId,
    uiTokenAmount: {
      amount: bal.uiTokenAmount.amount,
      decimals: bal.uiTokenAmount.decimals,
      uiAmountString: bal.uiTokenAmount.uiAmountString,
    },
  }));

  const rawTx: RawTransaction = {
    signature: sig as unknown as RawTransaction["signature"],
    slot: resp.slot,
    blockTime: resp.blockTime,
    fee: Number(resp.meta?.fee ?? 0),
    err: resp.meta?.err ?? null,
    programIds: extractProgramIdsFromMessage(resp.transaction.message),
    protocol: null,
    preTokenBalances,
    postTokenBalances,
    preBalances: (resp.meta?.preBalances ?? []).map((bal) => Number(bal)),
    postBalances: (resp.meta?.postBalances ?? []).map((bal) => Number(bal)),
    accountKeys,
    memo,
  };

  return rawTx;
}

/**
 * Fetches multiple transactions in batched JSON-RPC requests.
 *
 * This significantly reduces HTTP request overhead by combining multiple
 * getTransaction calls into single HTTP requests.
 *
 * @param rpcUrl - The RPC endpoint URL
 * @param signatures - Array of transaction signatures to fetch
 * @param config - Batch configuration options
 * @returns Array of RawTransaction objects (nulls filtered out)
 */
export async function fetchTransactionsBatched(
  rpcUrl: string,
  signatures: Signature[],
  config: BatchConfig = {},
): Promise<RawTransaction[]> {
  const {
    // Default batch size of 5 - conservative to avoid rate limits
    // on free tier RPCs (10 req/sec). Paid tiers can increase this.
    batchSize = 5,
    commitment = "confirmed",
    retry,
    // Default to 10 req/sec (Helius free tier limit)
    requestsPerSecond = 10,
  } = config;

  if (signatures.length === 0) {
    return [];
  }

  const sigStrings = signatures.map((sig) => sig.toString());
  const batches = chunk(sigStrings, batchSize);
  const allResults: (RawTransaction | null)[] = new Array(signatures.length);
  let globalIndex = 0;

  // Calculate delay between batches based on rate limit
  // Each batch contains `batchSize` RPC calls, so we need to wait
  // (batchSize / requestsPerSecond) seconds between batches
  // We add 100ms buffer to account for previous SDK calls
  const delayBetweenBatches =
    requestsPerSecond > 0
      ? Math.ceil((batchSize / requestsPerSecond) * 1000) + 100
      : 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]!;

    // Add delay before each batch (including first) to respect rate limit
    // This accounts for other SDK calls that may have just happened
    if (delayBetweenBatches > 0) {
      await sleep(delayBetweenBatches);
    }

    const requests: JsonRpcRequest[] = batch.map((sig, idx) => ({
      jsonrpc: "2.0" as const,
      id: globalIndex + idx,
      method: "getTransaction",
      params: [
        sig,
        {
          commitment,
          maxSupportedTransactionVersion: 0,
          encoding: "json",
        },
      ],
    }));

    const responses = await sendBatchRequest<GetTransactionResponse | null>(
      rpcUrl,
      requests,
      retry,
    );

    for (const resp of responses) {
      const idx = resp.id;
      const sig = sigStrings[idx];

      if (sig === undefined) {
        continue;
      }

      if (resp.error) {
        console.warn(
          `Failed to fetch transaction ${sig}: ${resp.error.message}`,
        );
        allResults[idx] = null;
      } else {
        allResults[idx] = responseToRawTransaction(sig, resp.result ?? null);
      }
    }

    globalIndex += batch.length;
  }

  return allResults.filter((tx): tx is RawTransaction => tx !== null);
}

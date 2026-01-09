import {
  type Address,
  type Rpc,
  type Signature,
  type GetSignaturesForAddressApi,
  type GetTransactionApi,
  type GetTokenAccountsByOwnerApi,
  address,
} from "@solana/kit";
import type { RawTransaction } from "@tx-indexer/core/tx/tx.types";
import { extractProgramIds } from "@tx-indexer/solana/mappers/transaction-mapper";
import { extractMemo } from "@tx-indexer/solana/mappers/memo-parser";
import { withRetry, type RetryConfig } from "@tx-indexer/solana/rpc/retry";
import { fetchTransactionsBatched } from "@tx-indexer/solana/rpc/batch";
import pLimit from "p-limit";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "../constants/program-ids";

export interface FetchTransactionsConfig {
  limit?: number;
  before?: Signature;
  until?: Signature;
}

export interface FetchTransactionOptions {
  commitment?: "confirmed" | "finalized";
  retry?: RetryConfig;
}

export interface FetchBatchOptions {
  commitment?: "confirmed" | "finalized";
  concurrency?: number;
  retry?: RetryConfig;
  onFetchError?: (signature: Signature, error: Error) => void;
  /** RPC URL for batched requests. If provided, uses JSON-RPC batching. */
  rpcUrl?: string;
  /** Batch size for JSON-RPC batching (default: 100) */
  batchSize?: number;
}

export interface FetchSignaturesPagedOptions {
  pageSize?: number;
  before?: Signature;
  until?: Signature;
  retry?: RetryConfig;
}

export interface FetchTokenAccountSignaturesOptions {
  concurrency?: number;
  limit?: number;
  before?: Signature;
  until?: Signature;
  retry?: RetryConfig;
  onError?: (ata: Address, error: Error) => void;
}

export async function fetchWalletSignatures(
  rpc: Rpc<GetSignaturesForAddressApi>,
  walletAddress: Address,
  config: FetchTransactionsConfig = {},
): Promise<RawTransaction[]> {
  const { limit = 100, before, until } = config;

  const response = await rpc
    .getSignaturesForAddress(walletAddress, {
      limit,
      before,
      until,
    })
    .send();

  return response.map((sig) => ({
    signature: sig.signature,
    slot: sig.slot,
    blockTime: sig.blockTime,
    err: sig.err,
    programIds: [],
    protocol: null,
    memo: sig.memo || null,
  }));
}

export async function fetchWalletSignaturesPaged(
  rpc: Rpc<GetSignaturesForAddressApi>,
  walletAddress: Address,
  options: FetchSignaturesPagedOptions = {},
): Promise<RawTransaction[]> {
  const { pageSize = 100, before, until, retry } = options;

  const response = await withRetry(
    () =>
      rpc
        .getSignaturesForAddress(walletAddress, {
          limit: pageSize,
          before,
          until,
        })
        .send(),
    retry,
  );

  return response.map((sig) => ({
    signature: sig.signature,
    slot: sig.slot,
    blockTime: sig.blockTime,
    err: sig.err,
    programIds: [],
    protocol: null,
    memo: sig.memo || null,
  }));
}

export async function fetchWalletTokenAccounts(
  rpc: Rpc<GetTokenAccountsByOwnerApi>,
  walletAddress: Address,
  retry?: RetryConfig,
): Promise<Address[]> {
  const tokenPrograms = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];

  const responses = await Promise.all(
    tokenPrograms.map((programId) =>
      withRetry(
        () =>
          rpc
            .getTokenAccountsByOwner(
              walletAddress,
              { programId: address(programId) },
              { encoding: "jsonParsed" },
            )
            .send(),
        retry,
      ).catch(() => ({ value: [] })),
    ),
  );

  const tokenAccounts: Address[] = [];
  for (const response of responses) {
    for (const account of response.value) {
      tokenAccounts.push(account.pubkey);
    }
  }

  return tokenAccounts;
}

export async function fetchTokenAccountSignaturesThrottled(
  rpc: Rpc<GetSignaturesForAddressApi>,
  tokenAccounts: Address[],
  options: FetchTokenAccountSignaturesOptions = {},
): Promise<RawTransaction[]> {
  const {
    concurrency = 3,
    limit = 100,
    before,
    until,
    retry,
    onError,
  } = options;

  if (tokenAccounts.length === 0) {
    return [];
  }

  const limiter = pLimit(concurrency);

  const fetchForAta = async (ata: Address): Promise<RawTransaction[]> => {
    try {
      return await withRetry(async () => {
        const response = await rpc
          .getSignaturesForAddress(ata, { limit, before, until })
          .send();

        return response.map((sig) => ({
          signature: sig.signature,
          slot: sig.slot,
          blockTime: sig.blockTime,
          err: sig.err,
          programIds: [],
          protocol: null,
          memo: sig.memo || null,
        }));
      }, retry);
    } catch (error) {
      onError?.(ata, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  };

  const results = await Promise.all(
    tokenAccounts.map((ata) => limiter(() => fetchForAta(ata))),
  );

  const signatureMap = new Map<string, RawTransaction>();
  for (const batch of results) {
    for (const tx of batch) {
      if (!signatureMap.has(tx.signature)) {
        signatureMap.set(tx.signature, tx);
      }
    }
  }

  return Array.from(signatureMap.values()).sort((a, b) => {
    const slotA = typeof a.slot === "bigint" ? a.slot : BigInt(a.slot);
    const slotB = typeof b.slot === "bigint" ? b.slot : BigInt(b.slot);
    return slotB > slotA ? 1 : slotB < slotA ? -1 : 0;
  });
}

export async function fetchWalletAndTokenSignatures(
  rpc: Rpc<GetSignaturesForAddressApi & GetTokenAccountsByOwnerApi>,
  walletAddress: Address,
  config: FetchTransactionsConfig = {},
): Promise<RawTransaction[]> {
  const { limit = 100, before, until } = config;

  const tokenAccounts = await fetchWalletTokenAccounts(rpc, walletAddress);
  const allAddresses = [walletAddress, ...tokenAccounts];

  const signaturePromises = allAddresses.map((addr) =>
    rpc
      .getSignaturesForAddress(addr, {
        limit,
        before,
        until,
      })
      .send()
      .catch(() => []),
  );

  const responses = await Promise.all(signaturePromises);

  const signatureMap = new Map<string, RawTransaction>();
  for (const response of responses) {
    for (const sig of response) {
      if (!signatureMap.has(sig.signature)) {
        signatureMap.set(sig.signature, {
          signature: sig.signature,
          slot: sig.slot,
          blockTime: sig.blockTime,
          err: sig.err,
          programIds: [],
          protocol: null,
          memo: sig.memo || null,
        });
      }
    }
  }

  const sortedSignatures = Array.from(signatureMap.values()).sort((a, b) => {
    const slotA = typeof a.slot === "bigint" ? a.slot : BigInt(a.slot);
    const slotB = typeof b.slot === "bigint" ? b.slot : BigInt(b.slot);
    return slotB > slotA ? 1 : slotB < slotA ? -1 : 0;
  });

  return sortedSignatures.slice(0, limit);
}

export async function fetchTransaction(
  rpc: Rpc<GetTransactionApi>,
  signature: Signature,
  options: FetchTransactionOptions = {},
): Promise<RawTransaction | null> {
  const { commitment = "confirmed", retry } = options;

  const response = await withRetry(
    () =>
      rpc
        .getTransaction(signature, {
          commitment,
          maxSupportedTransactionVersion: 0,
          encoding: "json",
        })
        .send(),
    retry,
  );

  if (!response) {
    return null;
  }

  const transactionWithLogs = {
    ...response.transaction,
    meta: { logMessages: response.meta?.logMessages },
  };
  const memo = extractMemo(transactionWithLogs);

  return {
    signature,
    slot: response.slot,
    blockTime: response.blockTime,
    fee: Number(response.meta?.fee ?? 0),
    err: response.meta?.err ?? null,
    programIds: extractProgramIds(response.transaction),
    protocol: null,
    preTokenBalances: (response.meta?.preTokenBalances ?? []).map((bal) => ({
      accountIndex: bal.accountIndex,
      mint: bal.mint.toString(),
      owner: bal.owner?.toString(),
      programId: bal.programId?.toString(),
      uiTokenAmount: {
        amount: bal.uiTokenAmount.amount.toString(),
        decimals: bal.uiTokenAmount.decimals,
        uiAmountString: bal.uiTokenAmount.uiAmountString.toString(),
      },
    })),
    postTokenBalances: (response.meta?.postTokenBalances ?? []).map((bal) => ({
      accountIndex: bal.accountIndex,
      mint: bal.mint.toString(),
      owner: bal.owner?.toString(),
      programId: bal.programId?.toString(),
      uiTokenAmount: {
        amount: bal.uiTokenAmount.amount.toString(),
        decimals: bal.uiTokenAmount.decimals,
        uiAmountString: bal.uiTokenAmount.uiAmountString.toString(),
      },
    })),
    preBalances: (response.meta?.preBalances ?? []).map((bal) => Number(bal)),
    postBalances: (response.meta?.postBalances ?? []).map((bal) => Number(bal)),
    accountKeys: response.transaction.message.accountKeys.map((key) =>
      key.toString(),
    ),
    memo,
  };
}

export async function fetchTransactionsBatch(
  rpc: Rpc<GetTransactionApi>,
  signatures: Signature[],
  options: FetchBatchOptions = {},
): Promise<RawTransaction[]> {
  const {
    commitment = "confirmed",
    concurrency = 5,
    retry,
    onFetchError,
    rpcUrl,
    batchSize = 100,
  } = options;

  if (signatures.length === 0) {
    return [];
  }

  // Use JSON-RPC batching if rpcUrl is provided
  if (rpcUrl) {
    try {
      return await fetchTransactionsBatched(rpcUrl, signatures, {
        commitment,
        batchSize,
        retry,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Silently skip batching if not supported (e.g., Helius free tier)
      if (!errorMsg.includes("BATCH_NOT_SUPPORTED")) {
        console.warn(
          "Batch request failed, falling back to individual requests:",
          error,
        );

        // If we failed due to rate limiting, use lower concurrency for fallback
        const isRateLimit =
          errorMsg.includes("429") || errorMsg.includes("Too Many");
        if (isRateLimit) {
          // Use concurrency of 2 with delay between requests
          const rateLimitedConcurrency = pLimit(2);
          const safeFetchRateLimited = async (
            sig: Signature,
          ): Promise<RawTransaction | null> => {
            try {
              // Add small delay to help with rate limiting
              await new Promise((r) => setTimeout(r, 200));
              return await fetchTransaction(rpc, sig, { commitment, retry });
            } catch (err) {
              onFetchError?.(
                sig,
                err instanceof Error ? err : new Error(String(err)),
              );
              return null;
            }
          };
          const results = await Promise.all(
            signatures.map((sig) =>
              rateLimitedConcurrency(() => safeFetchRateLimited(sig)),
            ),
          );
          return results.filter((tx): tx is RawTransaction => tx !== null);
        }
      }
      // Fall through to standard individual requests
    }
  }

  // Fall back to individual requests with concurrency limiting
  const limit = pLimit(concurrency);

  const safeFetch = async (sig: Signature): Promise<RawTransaction | null> => {
    try {
      return await fetchTransaction(rpc, sig, { commitment, retry });
    } catch (error) {
      onFetchError?.(
        sig,
        error instanceof Error ? error : new Error(String(error)),
      );
      return null;
    }
  };

  const promises = signatures.map((sig) => limit(() => safeFetch(sig)));

  const results = await Promise.all(promises);
  return results.filter((tx): tx is RawTransaction => tx !== null);
}

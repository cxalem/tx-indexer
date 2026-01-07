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
}

/**
 * Fetches transaction signatures for a wallet address.
 *
 * @param rpc - Solana RPC client
 * @param walletAddress - Wallet address to fetch signatures for
 * @param config - Optional pagination and limit configuration
 * @returns Array of raw transactions with basic metadata only
 */
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

/**
 * Fetches all token account (ATA) addresses for a wallet.
 *
 * @param rpc - Solana RPC client
 * @param walletAddress - Wallet address to fetch token accounts for
 * @returns Array of token account addresses (ATAs)
 */
export async function fetchWalletTokenAccounts(
  rpc: Rpc<GetTokenAccountsByOwnerApi>,
  walletAddress: Address,
): Promise<Address[]> {
  const tokenPrograms = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];

  const responses = await Promise.all(
    tokenPrograms.map((programId) =>
      rpc
        .getTokenAccountsByOwner(
          walletAddress,
          { programId: address(programId) },
          { encoding: "jsonParsed" },
        )
        .send()
        .catch(() => ({ value: [] })),
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

/**
 * Fetches transaction signatures for a wallet and all its token accounts (ATAs).
 * This captures incoming token transfers that only reference the ATA, not the wallet address.
 *
 * @param rpc - Solana RPC client
 * @param walletAddress - Wallet address to fetch signatures for
 * @param config - Optional pagination and limit configuration
 * @returns Array of raw transactions with basic metadata, deduplicated and sorted by slot (descending)
 */
export async function fetchWalletAndTokenSignatures(
  rpc: Rpc<GetSignaturesForAddressApi & GetTokenAccountsByOwnerApi>,
  walletAddress: Address,
  config: FetchTransactionsConfig = {},
): Promise<RawTransaction[]> {
  const { limit = 100, before, until } = config;

  // Fetch token accounts for the wallet
  const tokenAccounts = await fetchWalletTokenAccounts(rpc, walletAddress);

  // Fetch signatures for wallet and all token accounts in parallel
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

  // Merge and deduplicate signatures by signature string
  const signatureMap = new Map<string, RawTransaction>();

  for (const response of responses) {
    for (const sig of response) {
      // Only add if not already present (keep first occurrence which is most recent)
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

  // Sort by slot descending (most recent first)
  const sortedSignatures = Array.from(signatureMap.values()).sort((a, b) => {
    const slotA = typeof a.slot === "bigint" ? a.slot : BigInt(a.slot);
    const slotB = typeof b.slot === "bigint" ? b.slot : BigInt(b.slot);
    return slotB > slotA ? 1 : slotB < slotA ? -1 : 0;
  });

  // Return only up to the requested limit
  return sortedSignatures.slice(0, limit);
}

/**
 * Fetches a single transaction with full details including program IDs.
 *
 * @param rpc - Solana RPC client
 * @param signature - Transaction signature
 * @param options - Fetch options including commitment level and retry config
 * @returns Full raw transaction with program IDs, or null if not found
 */
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

  // Try to get memo from response metadata first (already decoded by RPC)
  // Fall back to manual extraction if not available
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

/**
 * Fetches multiple transactions with controlled concurrency.
 *
 * @param rpc - Solana RPC client
 * @param signatures - Array of transaction signatures to fetch
 * @param options - Fetch options including commitment level, concurrency limit, and retry config
 * @returns Array of successfully fetched transactions (nulls and errors filtered out)
 */
export async function fetchTransactionsBatch(
  rpc: Rpc<GetTransactionApi>,
  signatures: Signature[],
  options: FetchBatchOptions = {},
): Promise<RawTransaction[]> {
  const {
    commitment = "confirmed",
    concurrency = 10,
    retry,
    onFetchError,
  } = options;

  if (signatures.length === 0) {
    return [];
  }

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

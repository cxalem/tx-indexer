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
import {
  resolveAccountKeys,
  normalizeLoadedAddresses,
} from "@tx-indexer/solana/mappers/account-keys";
import { reconcileLamports } from "@tx-indexer/solana/mappers/lamport-reconciliation";
import {
  isUnsupportedTransactionVersionRpcError,
  UnsupportedTransactionVersionError,
  MAX_SUPPORTED_TRANSACTION_VERSION,
  type SkippedTransaction,
} from "@tx-indexer/solana/rpc/errors";
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
  /**
   * Called once for every requested signature that does not produce a
   * transaction, with the reason: "not_found" (RPC returned null),
   * "unsupported_version" (RPC refused: version newer than supported) or
   * "fetch_failed" (any other error, after retries).
   */
  onSkipped?: (skipped: SkippedTransaction) => void;
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

  let response;
  try {
    response = await withRetry(
      () =>
        rpc
          .getTransaction(signature, {
            commitment,
            maxSupportedTransactionVersion: MAX_SUPPORTED_TRANSACTION_VERSION,
            encoding: "json",
          })
          .send(),
      retry,
    );
  } catch (error) {
    if (isUnsupportedTransactionVersionRpcError(error)) {
      throw new UnsupportedTransactionVersionError(signature, { cause: error });
    }
    throw error;
  }

  if (!response) {
    return null;
  }

  const transactionWithLogs = {
    ...response.transaction,
    meta: { logMessages: response.meta?.logMessages },
  };
  // Memo decoding only looks at top-level instructions, whose program ids are
  // always static keys (the runtime forbids loading program ids from lookup
  // tables), so it keeps using the static message keys.
  const memo = extractMemo(transactionWithLogs);

  const meta = response.meta;
  const loadedAddresses = normalizeLoadedAddresses(
    meta && "loadedAddresses" in meta
      ? (meta as { loadedAddresses?: Parameters<typeof normalizeLoadedAddresses>[0] })
          .loadedAddresses
      : undefined,
  );
  const accountKeys = resolveAccountKeys(
    response.transaction.message.accountKeys,
    loadedAddresses,
  );

  const rawTx: RawTransaction = {
    signature,
    slot: response.slot,
    blockTime: response.blockTime,
    fee: meta ? lamportsToSafeNumber(meta.fee) : undefined,
    err: meta?.err ?? null,
    programIds: extractProgramIds(response.transaction),
    protocol: null,
    preTokenBalances: (meta?.preTokenBalances ?? []).map((bal) => ({
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
    postTokenBalances: (meta?.postTokenBalances ?? []).map((bal) => ({
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
    // Lamports stay exact: @solana/kit parses them as bigint, and we keep them.
    preBalances: (meta?.preBalances ?? []).map((bal) => BigInt(bal)),
    postBalances: (meta?.postBalances ?? []).map((bal) => BigInt(bal)),
    accountKeys,
    ...(loadedAddresses ? { loadedAddresses } : {}),
    memo,
  };
  rawTx.reconciliation = reconcileLamports(rawTx, { rewards: meta?.rewards });

  return rawTx;
}

/**
 * Converts a lamport amount to a number only when it is exactly representable.
 * Used for `RawTransaction.fee`, which is typed `number` for backward
 * compatibility (real fees are far below 2^53 lamports). An unrepresentable
 * value yields undefined, which makes the reconciliation `unavailable` rather
 * than silently rounding.
 */
function lamportsToSafeNumber(
  value: bigint | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : undefined;
  }
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return undefined;
  }
  return Number(value);
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
    onSkipped,
    rpcUrl,
    batchSize = 100,
  } = options;

  if (signatures.length === 0) {
    return [];
  }

  // JSON-RPC batching is only available on paid RPC tiers
  // For now, we skip it entirely to avoid rate limit issues
  // TODO: Re-enable when we have a way to detect paid tier
  // if (rpcUrl) { ... }

  // Fall back to individual requests with concurrency limiting
  const limit = pLimit(concurrency);

  // Exactly one notification per skipped signature. The try/catch covers
  // only the RPC fetch; callbacks run afterwards, so an exception thrown by a
  // callback propagates to the caller and is never relabelled as a fetch
  // failure (and never triggers a second notification).
  const safeFetch = async (sig: Signature): Promise<RawTransaction | null> => {
    let tx: RawTransaction | null = null;
    let failure: Error | null = null;
    try {
      tx = await fetchTransaction(rpc, sig, { commitment, retry });
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error));
    }

    if (failure) {
      onFetchError?.(sig, failure);
      onSkipped?.({
        signature: sig,
        reason:
          failure instanceof UnsupportedTransactionVersionError
            ? "unsupported_version"
            : "fetch_failed",
        error: failure,
      });
      return null;
    }

    if (!tx) {
      onSkipped?.({ signature: sig, reason: "not_found" });
    }
    return tx;
  };

  const promises = signatures.map((sig) => limit(() => safeFetch(sig)));

  const results = await Promise.all(promises);
  return results.filter((tx): tx is RawTransaction => tx !== null);
}

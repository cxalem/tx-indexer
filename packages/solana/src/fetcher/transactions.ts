import type {
  Address,
  Rpc,
  Signature,
  GetSignaturesForAddressApi,
  GetTransactionApi,
} from "@solana/kit";
import type { RawTransaction } from "@tx-indexer/core/tx/tx.types";
import { extractProgramIds } from "@tx-indexer/solana/mappers/transaction-mapper";
import { extractMemo } from "@tx-indexer/solana/mappers/memo-parser";

export interface FetchTransactionsConfig {
  limit?: number;
  before?: Signature;
  until?: Signature;
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
  config: FetchTransactionsConfig = {}
): Promise<RawTransaction[]> {
  const { limit = 1000, before, until } = config;

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
 * Fetches a single transaction with full details including program IDs.
 *
 * @param rpc - Solana RPC client
 * @param signature - Transaction signature
 * @param commitment - Commitment level for fetching
 * @returns Full raw transaction with program IDs
 */
export async function fetchTransaction(
  rpc: Rpc<GetTransactionApi>,
  signature: Signature,
  commitment: "confirmed" | "finalized" = "confirmed"
): Promise<RawTransaction | null> {
  const response = await rpc
    .getTransaction(signature, {
      commitment,
      maxSupportedTransactionVersion: 0,
      encoding: "json",
    })
    .send();

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
      key.toString()
    ),
    memo,
  };
}

/**
 * Fetches multiple transactions in parallel.
 *
 * @param rpc - Solana RPC client
 * @param signatures - Array of transaction signatures
 * @param commitment - Commitment level for fetching
 * @returns Array of full raw transactions (nulls filtered out)
 */
export async function fetchTransactionsBatch(
  rpc: Rpc<GetTransactionApi>,
  signatures: Signature[],
  commitment: "confirmed" | "finalized" = "confirmed"
): Promise<RawTransaction[]> {
  const promises = signatures.map((sig) =>
    fetchTransaction(rpc, sig, commitment)
  );
  const results = await Promise.all(promises);
  return results.filter((tx): tx is RawTransaction => tx !== null);
}

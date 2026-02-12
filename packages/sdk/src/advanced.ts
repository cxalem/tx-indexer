/**
 * Advanced APIs for power users who need fine-grained control.
 *
 * These exports are stable but require more knowledge of Solana internals.
 * For most use cases, prefer the main `createIndexer()` API.
 *
 * @module tx-indexer/advanced
 * @stability advanced
 */

// Low-level fetchers - direct RPC access
export {
  fetchWalletBalance,
  type WalletBalance,
  type TokenAccountBalance,
} from "@tx-indexer/solana/fetcher/balances";

export {
  fetchWalletSignatures,
  fetchWalletTokenAccounts,
  fetchWalletAndTokenSignatures,
  fetchTransaction,
  fetchTransactionsBatch,
  type FetchBatchOptions,
  type FetchTransactionOptions,
} from "@tx-indexer/solana/fetcher/transactions";

// RPC client creation - for custom client setups
export {
  createSolanaClient,
  type IndexerRpcApi,
  type SolanaClient,
} from "@tx-indexer/solana/rpc/client";

// Retry configuration
export { type RetryConfig } from "@tx-indexer/solana/rpc/retry";

// Transaction leg mapping - for custom classification pipelines
export { transactionToLegs } from "@tx-indexer/solana/mappers/transaction-to-legs";

// Classification engine - for custom classification logic
export {
  classifyTransaction,
  type ClassificationService,
} from "@tx-indexer/classification/engine/classification-service";

// Protocol detection
export { detectProtocol } from "@tx-indexer/classification/protocols/detector";

// Spam filtering
export {
  isSpamTransaction,
  filterSpamTransactions,
  type SpamFilterConfig,
} from "@tx-indexer/core/tx/spam-filter";

// Leg validation and grouping utilities
export {
  validateLegsBalance,
  groupLegsByAccount,
  groupLegsByToken,
  type LegBalanceResult,
  type LegTokenBalance,
} from "@tx-indexer/core/tx/leg-validation";

// Account ID utilities
export {
  buildAccountId,
  parseAccountId,
  type AccountIdType,
  type BuildAccountIdParams,
  type ParsedAccountId,
} from "@tx-indexer/core/tx/account-id";

// Memo parsing
export {
  extractMemo,
  parseSolanaPayMemo,
  isSolanaPayTransaction,
  type SolanaPayMemo,
} from "@tx-indexer/solana/mappers/memo-parser";

// Token fetcher - for custom token metadata resolution
export {
  createTokenFetcher,
  getDefaultTokenFetcher,
  type TokenFetcher,
  type TokenFetcherOptions,
} from "@tx-indexer/core/money/token-fetcher";

// Program IDs and facilitator detection
export {
  JUPITER_V6_PROGRAM_ID,
  JUPITER_V4_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  SPL_MEMO_PROGRAM_ID,
  detectFacilitator,
} from "@tx-indexer/solana/constants/program-ids";

// NFT metadata fetching (requires DAS RPC)
export {
  fetchNftMetadata,
  fetchNftMetadataBatch,
  type NftMetadata,
} from "./nft";

// Helius Wallet API helpers
export {
  fetchWalletFundingSource,
  DEFAULT_HELIUS_WALLET_API_BASE_URL,
  type WalletFundingSource,
  type FetchWalletFundingSourceOptions,
} from "./wallet-api";

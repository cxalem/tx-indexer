export {
  createIndexer,
  type TxIndexer,
  type TxIndexerOptions,
  type GetTransactionsOptions,
  type GetTransactionOptions,
  type ClassifiedTransaction,
  type FetchTransactionsConfig,
} from "./client";

export type * from "./types";

export {
  createSolanaClient,
  parseAddress,
  parseSignature,
  type IndexerRpcApi,
  type SolanaClient,
} from "@tx-indexer/solana/rpc/client";

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

export { type RetryConfig } from "@tx-indexer/solana/rpc/retry";

export { transactionToLegs } from "@tx-indexer/solana/mappers/transaction-to-legs";

export {
  classifyTransaction,
  type ClassificationService,
} from "@tx-indexer/classification/engine/classification-service";

export { detectProtocol } from "@tx-indexer/classification/protocols/detector";

export {
  isSpamTransaction,
  filterSpamTransactions,
  type SpamFilterConfig,
} from "@tx-indexer/core/tx/spam-filter";

export {
  validateLegsBalance,
  groupLegsByAccount,
  groupLegsByToken,
  type LegBalanceResult,
  type LegTokenBalance,
} from "@tx-indexer/core/tx/leg-validation";

export {
  buildAccountId,
  parseAccountId,
  type AccountIdType,
  type BuildAccountIdParams,
  type ParsedAccountId,
} from "@tx-indexer/core/tx/account-id";

export {
  extractMemo,
  parseSolanaPayMemo,
  isSolanaPayTransaction,
  type SolanaPayMemo,
} from "@tx-indexer/solana/mappers/memo-parser";

export {
  KNOWN_TOKENS,
  TOKEN_INFO,
  getTokenInfo,
  createUnknownToken,
  SUPPORTED_STABLECOINS,
  LIQUID_STAKING_TOKENS,
} from "@tx-indexer/core/money/token-registry";

export {
  createTokenFetcher,
  getDefaultTokenFetcher,
  type TokenFetcher,
  type TokenFetcherOptions,
} from "@tx-indexer/core/money/token-fetcher";

export {
  JUPITER_V6_PROGRAM_ID,
  JUPITER_V4_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  SPL_MEMO_PROGRAM_ID,
  detectFacilitator,
} from "@tx-indexer/solana/constants/program-ids";

export {
  fetchNftMetadata,
  fetchNftMetadataBatch,
  type NftMetadata,
} from "./nft";

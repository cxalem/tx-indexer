/**
 * tx-indexer SDK - Solana transaction indexing and classification
 *
 * This is the main entry point with stable, production-ready APIs.
 * For advanced/low-level APIs, import from "tx-indexer/advanced".
 *
 * @example
 * ```typescript
 * import { createIndexer } from "tx-indexer";
 *
 * // Mainnet (default)
 * const indexer = createIndexer({ rpcUrl: "https://api.mainnet-beta.solana.com" });
 * const txs = await indexer.getTransactions("YourWalletAddress...", { limit: 10 });
 *
 * // Devnet
 * const devnetIndexer = createIndexer({
 *   rpcUrl: "https://api.devnet.solana.com",
 *   cluster: "devnet",
 * });
 * ```
 *
 * @module tx-indexer
 * @stability stable
 */

// ============================================================================
// Core Client API
// ============================================================================

export {
  createIndexer,
  type TxIndexer,
  type TxIndexerOptions,
  type GetTransactionsOptions,
  type GetTransactionOptions,
  type ClassifiedTransaction,
  type FetchTransactionsConfig,
  type AddressInput,
  type SignatureInput,
  // EXPERIMENTAL: Signatures-First API
  type SignatureInfo,
  type GetSignaturesOptions,
  type GetSignaturesResult,
  type GetTransactionsBySignaturesOptions,
} from "./client";

// ============================================================================
// Type Definitions
// ============================================================================

export type * from "./types";

// ============================================================================
// Address/Signature Parsing (required for typed API)
// ============================================================================

export { parseAddress, parseSignature } from "@tx-indexer/solana/rpc/client";

// ============================================================================
// Token Registry (commonly needed for display)
// ============================================================================

export {
  KNOWN_TOKENS,
  TOKEN_INFO,
  DEVNET_KNOWN_TOKENS,
  DEVNET_TOKEN_INFO,
  getTokenInfo,
  createUnknownToken,
  SUPPORTED_STABLECOINS,
  LIQUID_STAKING_TOKENS,
} from "@tx-indexer/core/money/token-registry";

// ============================================================================
// Network Types
// ============================================================================

export type { Cluster } from "@tx-indexer/core/core/network.types";

// ============================================================================
// JSON Serialization (for server-side usage)
// ============================================================================

export {
  toJsonClassifiedTransaction,
  toJsonClassifiedTransactions,
  type JsonTokenInfo,
  type JsonFiatValue,
  type JsonMoneyAmount,
  type JsonTokenBalance,
  type JsonProtocolInfo,
  type JsonRawTransaction,
  type JsonCounterparty,
  type JsonTransactionClassification,
  type JsonTxLeg,
  type JsonClassifiedTransaction,
} from "./json-types";

// ============================================================================
// Errors
// ============================================================================

export {
  TxIndexerError,
  RateLimitError,
  RpcError,
  NetworkError,
  InvalidInputError,
  ConfigurationError,
  NftMetadataError,
  isTxIndexerError,
  isRetryableError,
  wrapError,
} from "./errors";

// ============================================================================
// Utilities
// ============================================================================

export {
  detectNewATAs,
  hasNewATAForOwner,
  getNewATAsForOwner,
  detectNewATAsBatch,
  type DetectedATA,
} from "./utils/ata-detector";

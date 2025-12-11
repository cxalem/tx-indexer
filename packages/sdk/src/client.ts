import type { Address, Signature } from "@solana/kit";
import {
  createSolanaClient,
  parseAddress,
  parseSignature,
  type SolanaClient,
} from "@tx-indexer/solana/rpc/client";
import { fetchWalletBalance } from "@tx-indexer/solana/fetcher/balances";
import {
  fetchWalletSignatures,
  fetchTransaction,
  fetchTransactionsBatch,
  type FetchTransactionsConfig,
} from "@tx-indexer/solana/fetcher/transactions";

export type { FetchTransactionsConfig } from "@tx-indexer/solana/fetcher/transactions";
import { transactionToLegs } from "@tx-indexer/solana/mappers/transaction-to-legs";
import { classifyTransaction } from "@tx-indexer/classification/engine/classification-service";
import { detectProtocol } from "@tx-indexer/classification/protocols/detector";
import { filterSpamTransactions, type SpamFilterConfig } from "@tx-indexer/core/tx/spam-filter";
import type { WalletBalance } from "@tx-indexer/solana/fetcher/balances";
import type { RawTransaction } from "@tx-indexer/core/tx/tx.types";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";

/**
 * Configuration options for creating a transaction indexer.
 * 
 * Use either `rpcUrl` to let the SDK create a client, or provide an existing `client`
 * to share connections across your application.
 */
export type TxIndexerOptions =
  | { 
      /** Solana RPC URL (SDK creates a new client) */
      rpcUrl: string; 
      /** Optional WebSocket URL for subscriptions */
      wsUrl?: string;
    }
  | { 
      /** Existing Solana client to reuse (shares connections) */
      client: SolanaClient;
    };

/**
 * Options for fetching and filtering transaction history.
 */
export interface GetTransactionsOptions {
  /** Maximum number of transactions to return (default: 10) */
  limit?: number;
  /** Fetch transactions before this signature (for pagination) */
  before?: Signature;
  /** Fetch transactions until this signature (for pagination) */
  until?: Signature;
  /** Whether to filter out spam transactions (default: true) */
  filterSpam?: boolean;
  /** Custom spam filter configuration */
  spamConfig?: SpamFilterConfig;
}

/**
 * A fully classified transaction with raw data, classification metadata, and accounting legs.
 */
export interface ClassifiedTransaction {
  /** Raw transaction data from the blockchain */
  tx: RawTransaction;
  /** Classification metadata (type, direction, amounts, counterparty) */
  classification: TransactionClassification;
  /** Accounting legs representing all balance movements */
  legs: ReturnType<typeof transactionToLegs>;
}

/**
 * Transaction indexer client for querying and classifying Solana transactions.
 * 
 * Provides methods to fetch wallet balances, transaction history, and individual transactions
 * with automatic protocol detection and classification.
 */
export interface TxIndexer {
  /** Direct access to the underlying Solana RPC client */
  rpc: ReturnType<typeof createSolanaClient>["rpc"];
  
  /**
   * Fetches the SOL and SPL token balances for a wallet.
   * 
   * @param walletAddress - Wallet address to query balances for
   * @param tokenMints - Optional array of token mint addresses to filter. If omitted, returns all tokens
   * @returns Wallet balance data including SOL and token balances
   * 
   * @example
   * // Get all balances
   * const balance = await indexer.getBalance("YourWalletAddress...");
   * console.log(balance.sol.ui); // SOL balance
   * console.log(balance.tokens); // All token balances
   * 
   * @example
   * // Get specific token balances
   * const balance = await indexer.getBalance(
   *   "YourWalletAddress...",
   *   ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"] // USDC
   * );
   */
  getBalance(
    walletAddress: string | Address,
    tokenMints?: readonly string[]
  ): Promise<WalletBalance>;
  
  /**
   * Fetches and classifies transaction history for a wallet.
   * 
   * Retrieves transactions from the blockchain, detects protocols, classifies each transaction
   * (transfer, swap, etc.), and optionally filters out spam. Returns transactions with full
   * classification data including type, direction, amounts, and counterparty information.
   * 
   * @param walletAddress - Wallet address to fetch transaction history for
   * @param options - Configuration options for fetching and filtering
   * @param options.limit - Maximum number of transactions to return (default: 10)
   * @param options.before - Fetch transactions before this signature (pagination)
   * @param options.until - Fetch transactions until this signature (pagination)
   * @param options.filterSpam - Whether to filter out spam transactions (default: true)
   * @param options.spamConfig - Custom spam filter configuration
   * @returns Array of classified transactions with full metadata
   * 
   * @example
   * // Get latest 10 transactions
   * const txs = await indexer.getTransactions("YourWalletAddress...");
   * 
   * @example
   * // Get 20 transactions including spam
   * const txs = await indexer.getTransactions("YourWalletAddress...", {
   *   limit: 20,
   *   filterSpam: false
   * });
   * 
   * @example
   * // Pagination: get next page
   * const nextPage = await indexer.getTransactions("YourWalletAddress...", {
   *   before: lastTx.tx.signature,
   *   limit: 10
   * });
   */
  getTransactions(
    walletAddress: string | Address,
    options?: GetTransactionsOptions
  ): Promise<ClassifiedTransaction[]>;
  
  /**
   * Fetches and classifies a single transaction by its signature.
   * 
   * Retrieves the transaction from the blockchain, detects the protocol used, and classifies
   * it from the perspective of the provided wallet address. Returns full classification including
   * transaction type (swap, transfer, etc.), direction (incoming/outgoing), amounts, and counterparty.
   * 
   * @param signature - Transaction signature to fetch
   * @param walletAddress - Wallet address for classification context (determines perspective)
   * @returns Classified transaction with full metadata, or null if transaction not found
   * 
   * @example
   * const tx = await indexer.getTransaction(
   *   "5k9XPH7FKz...", // Transaction signature
   *   "YourWalletAddress..." // Your wallet for context
   * );
   * 
   * if (tx) {
   *   console.log(tx.classification.primaryType); // "swap", "transfer", etc.
   *   console.log(tx.classification.direction); // "incoming", "outgoing", etc.
   *   console.log(tx.classification.primaryAmount); // Amount data
   * }
   */
  getTransaction(
    signature: string | Signature,
    walletAddress: string | Address
  ): Promise<ClassifiedTransaction | null>;
  
  /**
   * Fetches a raw transaction without classification.
   * 
   * Retrieves the transaction data from the blockchain without any processing, classification,
   * or protocol detection. Useful when you only need the raw blockchain data or want to implement
   * custom classification logic.
   * 
   * @param signature - Transaction signature to fetch
   * @returns Raw transaction data from the blockchain, or null if not found
   * 
   * @example
   * const rawTx = await indexer.getRawTransaction("5k9XPH7FKz...");
   * 
   * if (rawTx) {
   *   console.log(rawTx.slot); // Block slot
   *   console.log(rawTx.blockTime); // Timestamp
   *   console.log(rawTx.programIds); // Programs involved
   * }
   */
  getRawTransaction(
    signature: string | Signature
  ): Promise<RawTransaction | null>;
}

/**
 * Creates a transaction indexer client for querying and classifying Solana transactions.
 * 
 * Accepts either an RPC URL (SDK creates client) or an existing SolanaClient (for sharing
 * connections across your app or with React providers).
 * 
 * @param options - Configuration with RPC URL or existing client
 * @returns Transaction indexer client
 * 
 * @example
 * // Option 1: SDK creates client
 * const indexer = createIndexer({ rpcUrl: "https://api.mainnet-beta.solana.com" });
 * 
 * @example
 * // Option 2: Provide existing client (share connections)
 * const myClient = createSolanaClient("https://...");
 * const indexer = createIndexer({ client: myClient });
 */
export function createIndexer(options: TxIndexerOptions): TxIndexer {
  const client = "client" in options
    ? options.client
    : createSolanaClient(options.rpcUrl, options.wsUrl);

  return {
    rpc: client.rpc,

    /**
     * Fetches the SOL and SPL token balances for a wallet.
     * 
     * @param walletAddress - Wallet address to query balances for
     * @param tokenMints - Optional array of token mint addresses to filter. If omitted, returns all tokens
     * @returns Wallet balance data including SOL and token balances
     * 
     * @example
     * // Get all balances
     * const balance = await indexer.getBalance("YourWalletAddress...");
     * console.log(balance.sol.ui); // SOL balance
     * console.log(balance.tokens); // All token balances
     * 
     * @example
     * // Get specific token balances
     * const balance = await indexer.getBalance(
     *   "YourWalletAddress...",
     *   ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"] // USDC
     * );
     */
    async getBalance(
      walletAddress: string | Address,
      tokenMints?: readonly string[]
    ): Promise<WalletBalance> {
      const address =
        typeof walletAddress === "string"
          ? parseAddress(walletAddress)
          : walletAddress;

      return fetchWalletBalance(client.rpc, address, tokenMints);
    },

    /**
     * Fetches and classifies transaction history for a wallet.
     * 
     * Retrieves transactions from the blockchain, detects protocols, classifies each transaction
     * (transfer, swap, etc.), and optionally filters out spam. Returns transactions with full
     * classification data including type, direction, amounts, and counterparty information.
     * 
     * @param walletAddress - Wallet address to fetch transaction history for
     * @param options - Configuration options for fetching and filtering
     * @param options.limit - Maximum number of transactions to return (default: 10)
     * @param options.before - Fetch transactions before this signature (pagination)
     * @param options.until - Fetch transactions until this signature (pagination)
     * @param options.filterSpam - Whether to filter out spam transactions (default: true)
     * @param options.spamConfig - Custom spam filter configuration
     * @returns Array of classified transactions with full metadata
     * 
     * @example
     * // Get latest 10 transactions
     * const txs = await indexer.getTransactions("YourWalletAddress...");
     * 
     * @example
     * // Get 20 transactions including spam
     * const txs = await indexer.getTransactions("YourWalletAddress...", {
     *   limit: 20,
     *   filterSpam: false
     * });
     * 
     * @example
     * // Pagination: get next page
     * const nextPage = await indexer.getTransactions("YourWalletAddress...", {
     *   before: lastTx.tx.signature,
     *   limit: 10
     * });
     */
    async getTransactions(
      walletAddress: string | Address,
      options: GetTransactionsOptions = {}
    ): Promise<ClassifiedTransaction[]> {
      const { limit = 10, before, until, filterSpam = true, spamConfig } = options;

      const address =
        typeof walletAddress === "string"
          ? parseAddress(walletAddress)
          : walletAddress;

      const signatures = await fetchWalletSignatures(client.rpc, address, {
        limit,
        before,
        until,
      });

      if (signatures.length === 0) {
        return [];
      }

      const signatureObjects = signatures.map((sig) =>
        parseSignature(sig.signature)
      );
      const transactions = await fetchTransactionsBatch(
        client.rpc,
        signatureObjects
      );

      const walletAddressString =
        typeof walletAddress === "string" ? walletAddress : (walletAddress as unknown as string);

      const classified = transactions.map((tx) => {
        tx.protocol = detectProtocol(tx.programIds);
        const legs = transactionToLegs(tx, walletAddressString);
        const classification = classifyTransaction(legs, walletAddressString, tx);
        return { tx, classification, legs };
      });

      if (filterSpam) {
        return filterSpamTransactions(classified, spamConfig);
      }

      return classified;
    },

    /**
     * Fetches and classifies a single transaction by its signature.
     * 
     * Retrieves the transaction from the blockchain, detects the protocol used, and classifies
     * it from the perspective of the provided wallet address. Returns full classification including
     * transaction type (swap, transfer, etc.), direction (incoming/outgoing), amounts, and counterparty.
     * 
     * @param signature - Transaction signature to fetch
     * @param walletAddress - Wallet address for classification context (determines perspective)
     * @returns Classified transaction with full metadata, or null if transaction not found
     * 
     * @example
     * const tx = await indexer.getTransaction(
     *   "5k9XPH7FKz...", // Transaction signature
     *   "YourWalletAddress..." // Your wallet for context
     * );
     * 
     * if (tx) {
     *   console.log(tx.classification.primaryType); // "swap", "transfer", etc.
     *   console.log(tx.classification.direction); // "incoming", "outgoing", etc.
     *   console.log(tx.classification.primaryAmount); // Amount data
     * }
     */
    async getTransaction(
      signature: string | Signature,
      walletAddress: string | Address
    ): Promise<ClassifiedTransaction | null> {
      const sig =
        typeof signature === "string" ? parseSignature(signature) : signature;

      const tx = await fetchTransaction(client.rpc, sig);

      if (!tx) {
        return null;
      }

      tx.protocol = detectProtocol(tx.programIds);

      const walletAddressString =
        typeof walletAddress === "string" ? walletAddress : (walletAddress as unknown as string);

      const legs = transactionToLegs(tx, walletAddressString);
      const classification = classifyTransaction(legs, walletAddressString, tx);

      return { tx, classification, legs };
    },

    /**
     * Fetches a raw transaction without classification.
     * 
     * Retrieves the transaction data from the blockchain without any processing, classification,
     * or protocol detection. Useful when you only need the raw blockchain data or want to implement
     * custom classification logic.
     * 
     * @param signature - Transaction signature to fetch
     * @returns Raw transaction data from the blockchain, or null if not found
     * 
     * @example
     * const rawTx = await indexer.getRawTransaction("5k9XPH7FKz...");
     * 
     * if (rawTx) {
     *   console.log(rawTx.slot); // Block slot
     *   console.log(rawTx.blockTime); // Timestamp
     *   console.log(rawTx.programIds); // Programs involved
     * }
     */
    async getRawTransaction(
      signature: string | Signature
    ): Promise<RawTransaction | null> {
      const sig =
        typeof signature === "string" ? parseSignature(signature) : signature;

      return fetchTransaction(client.rpc, sig);
    },
  };
}

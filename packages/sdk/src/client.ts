import type { Address, Signature } from "@solana/kit";
import {
  createSolanaClient,
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
   * @param tokenMints - Optional array of token mint addresses to filter
   * @returns Wallet balance data including SOL and token balances
   */
  getBalance(
    walletAddress: Address,
    tokenMints?: readonly string[]
  ): Promise<WalletBalance>;
  
  /**
   * Fetches and classifies transaction history for a wallet.
   * 
   * @param walletAddress - Wallet address to fetch transaction history for
   * @param options - Configuration options for fetching and filtering
   * @returns Array of classified transactions with full metadata
   */
  getTransactions(
    walletAddress: Address,
    options?: GetTransactionsOptions
  ): Promise<ClassifiedTransaction[]>;
  
  /**
   * Fetches and classifies a single transaction by its signature.
   * 
   * @param signature - Transaction signature to fetch
   * @param walletAddress - Optional wallet address for classification perspective.
   *   When omitted, returns classification from observer mode (neutral perspective).
   * @returns Classified transaction with full metadata, or null if transaction not found
   */
  getTransaction(
    signature: Signature,
    walletAddress?: Address
  ): Promise<ClassifiedTransaction | null>;
  
  /**
   * Fetches a raw transaction without classification.
   * 
   * @param signature - Transaction signature to fetch
   * @returns Raw transaction data from the blockchain, or null if not found
   */
  getRawTransaction(signature: Signature): Promise<RawTransaction | null>;
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

    async getBalance(
      walletAddress: Address,
      tokenMints?: readonly string[]
    ): Promise<WalletBalance> {
      return fetchWalletBalance(client.rpc, walletAddress, tokenMints);
    },

    async getTransactions(
      walletAddress: Address,
      options: GetTransactionsOptions = {}
    ): Promise<ClassifiedTransaction[]> {
      const { limit = 10, before, until, filterSpam = true, spamConfig } = options;

      // If spam filtering is disabled, use original behavior (single fetch)
      if (!filterSpam) {
        const signatures = await fetchWalletSignatures(client.rpc, walletAddress, {
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

        const classified = transactions.map((tx) => {
          tx.protocol = detectProtocol(tx.programIds);
          const legs = transactionToLegs(tx, walletAddress);
          const classification = classifyTransaction(legs, walletAddress, tx);
          return { tx, classification, legs };
        });

        return classified;
      }

      const accumulated: ClassifiedTransaction[] = [];
      let currentBefore = before;
      const MAX_ITERATIONS = 10;
      let iteration = 0;

      while (accumulated.length < limit && iteration < MAX_ITERATIONS) {
        iteration++;

        const batchSize = iteration === 1 ? limit : limit * 2;

        const signatures = await fetchWalletSignatures(client.rpc, walletAddress, {
          limit: batchSize,
          before: currentBefore,
          until,
        });

        if (signatures.length === 0) {
          break;
        }

        const signatureObjects = signatures.map((sig) =>
          parseSignature(sig.signature)
        );
        const transactions = await fetchTransactionsBatch(
          client.rpc,
          signatureObjects
        );

        const classified = transactions.map((tx) => {
          tx.protocol = detectProtocol(tx.programIds);
          const legs = transactionToLegs(tx, walletAddress);
          const classification = classifyTransaction(legs, walletAddress, tx);
          return { tx, classification, legs };
        });

        const nonSpam = filterSpamTransactions(classified, spamConfig);
        accumulated.push(...nonSpam);

        const lastSignature = signatures[signatures.length - 1];
        if (lastSignature) {
          currentBefore = parseSignature(lastSignature.signature);
        } else {
          break;
        }
      }

      return accumulated.slice(0, limit);
    },

    async getTransaction(
      signature: Signature,
      walletAddress?: Address
    ): Promise<ClassifiedTransaction | null> {
      const tx = await fetchTransaction(client.rpc, signature);

      if (!tx) {
        return null;
      }

      tx.protocol = detectProtocol(tx.programIds);

      const legs = transactionToLegs(tx, walletAddress);
      const classification = classifyTransaction(legs, walletAddress, tx);

      return { tx, classification, legs };
    },

    async getRawTransaction(signature: Signature): Promise<RawTransaction | null> {
      return fetchTransaction(client.rpc, signature);
    },
  };
}

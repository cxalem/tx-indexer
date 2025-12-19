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

export type TxIndexerOptions =
  | { 
      rpcUrl: string; 
      wsUrl?: string;
    }
  | { 
      client: SolanaClient;
    };

export interface GetTransactionsOptions {
  limit?: number;
  before?: Signature;
  until?: Signature;
  filterSpam?: boolean;
  spamConfig?: SpamFilterConfig;
}

export interface ClassifiedTransaction {
  tx: RawTransaction;
  classification: TransactionClassification;
  legs: ReturnType<typeof transactionToLegs>;
}

export interface TxIndexer {
  rpc: ReturnType<typeof createSolanaClient>["rpc"];
  
  getBalance(
    walletAddress: Address,
    tokenMints?: readonly string[]
  ): Promise<WalletBalance>;
  
  getTransactions(
    walletAddress: Address,
    options?: GetTransactionsOptions
  ): Promise<ClassifiedTransaction[]>;
  
  getTransaction(signature: Signature): Promise<ClassifiedTransaction | null>;
  
  getRawTransaction(signature: Signature): Promise<RawTransaction | null>;
}

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
          const legs = transactionToLegs(tx);
          const classification = classifyTransaction(legs, tx);
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
          const legs = transactionToLegs(tx);
          const classification = classifyTransaction(legs, tx);
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

    async getTransaction(signature: Signature): Promise<ClassifiedTransaction | null> {
      const tx = await fetchTransaction(client.rpc, signature);

      if (!tx) {
        return null;
      }

      tx.protocol = detectProtocol(tx.programIds);

      const legs = transactionToLegs(tx);
      const classification = classifyTransaction(legs, tx);

      return { tx, classification, legs };
    },

    async getRawTransaction(signature: Signature): Promise<RawTransaction | null> {
      return fetchTransaction(client.rpc, signature);
    },
  };
}

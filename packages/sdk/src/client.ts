import type { Address, Signature } from "@solana/kit";
import {
  createSolanaClient,
  parseSignature,
  type SolanaClient,
} from "@tx-indexer/solana/rpc/client";
import { fetchWalletBalance } from "@tx-indexer/solana/fetcher/balances";
import {
  fetchWalletSignatures,
  fetchWalletAndTokenSignatures,
  fetchTransaction,
  fetchTransactionsBatch,
} from "@tx-indexer/solana/fetcher/transactions";

export type { FetchTransactionsConfig } from "@tx-indexer/solana/fetcher/transactions";
import { transactionToLegs } from "@tx-indexer/solana/mappers/transaction-to-legs";
import { classifyTransaction } from "@tx-indexer/classification/engine/classification-service";
import { detectProtocol } from "@tx-indexer/classification/protocols/detector";
import {
  filterSpamTransactions,
  type SpamFilterConfig,
} from "@tx-indexer/core/tx/spam-filter";
import type { WalletBalance } from "@tx-indexer/solana/fetcher/balances";
import type { RawTransaction, TxLeg } from "@tx-indexer/core/tx/tx.types";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type {
  TokenInfo,
  MoneyAmount,
} from "@tx-indexer/core/money/money.types";
import {
  createTokenFetcher,
  type TokenFetcher,
} from "@tx-indexer/core/money/token-fetcher";
import {
  fetchNftMetadata,
  fetchNftMetadataBatch,
  type NftMetadata,
} from "./nft";

const NFT_TRANSACTION_TYPES = ["nft_mint", "nft_purchase", "nft_sale"] as const;

/**
 * Enriches token metadata in legs and classification using the token fetcher.
 * This replaces "Unknown Token" placeholders with actual token metadata from Jupiter.
 */
async function enrichTokenMetadata(
  tokenFetcher: TokenFetcher,
  classified: ClassifiedTransaction,
): Promise<ClassifiedTransaction> {
  // Collect all unique mints from legs
  const mints = new Set<string>();
  const decimalsMap = new Map<string, number>();

  for (const leg of classified.legs) {
    const mint = leg.amount.token.mint;
    mints.add(mint);
    decimalsMap.set(mint, leg.amount.token.decimals);
  }

  // Also check classification amounts
  if (classified.classification.primaryAmount?.token.mint) {
    const mint = classified.classification.primaryAmount.token.mint;
    mints.add(mint);
    decimalsMap.set(
      mint,
      classified.classification.primaryAmount.token.decimals,
    );
  }
  if (classified.classification.secondaryAmount?.token.mint) {
    const mint = classified.classification.secondaryAmount.token.mint;
    mints.add(mint);
    decimalsMap.set(
      mint,
      classified.classification.secondaryAmount.token.decimals,
    );
  }

  if (mints.size === 0) {
    return classified;
  }

  // Fetch all token metadata
  const tokenInfoMap = await tokenFetcher.getTokens(
    Array.from(mints),
    9, // default decimals
  );

  // Helper to enrich a MoneyAmount
  function enrichAmount(
    amount: MoneyAmount | null | undefined,
  ): MoneyAmount | null | undefined {
    if (!amount) return amount;

    const enrichedToken = tokenInfoMap.get(amount.token.mint);
    if (!enrichedToken || enrichedToken.symbol === amount.token.symbol) {
      return amount;
    }

    return {
      ...amount,
      token: {
        ...enrichedToken,
        // Keep the decimals from the original (from RPC) as they're authoritative
        decimals: amount.token.decimals,
      },
    };
  }

  // Helper to enrich a leg
  function enrichLeg(leg: TxLeg): TxLeg {
    const enrichedToken = tokenInfoMap.get(leg.amount.token.mint);
    if (!enrichedToken || enrichedToken.symbol === leg.amount.token.symbol) {
      return leg;
    }

    return {
      ...leg,
      amount: {
        ...leg.amount,
        token: {
          ...enrichedToken,
          decimals: leg.amount.token.decimals,
        },
      },
    };
  }

  // Enrich legs
  const enrichedLegs = classified.legs.map(enrichLeg);

  // Enrich classification amounts
  const enrichedClassification: TransactionClassification = {
    ...classified.classification,
    primaryAmount:
      enrichAmount(classified.classification.primaryAmount) ?? null,
    secondaryAmount: enrichAmount(classified.classification.secondaryAmount),
  };

  return {
    tx: classified.tx,
    legs: enrichedLegs,
    classification: enrichedClassification,
  };
}

/**
 * Enriches token metadata for a batch of transactions.
 */
async function enrichTokenMetadataBatch(
  tokenFetcher: TokenFetcher,
  transactions: ClassifiedTransaction[],
): Promise<ClassifiedTransaction[]> {
  // Collect all unique mints across all transactions
  const mints = new Set<string>();

  for (const classified of transactions) {
    for (const leg of classified.legs) {
      mints.add(leg.amount.token.mint);
    }
    if (classified.classification.primaryAmount?.token.mint) {
      mints.add(classified.classification.primaryAmount.token.mint);
    }
    if (classified.classification.secondaryAmount?.token.mint) {
      mints.add(classified.classification.secondaryAmount.token.mint);
    }
  }

  if (mints.size === 0) {
    return transactions;
  }

  // Pre-fetch all tokens in one batch
  await tokenFetcher.getTokens(Array.from(mints));

  // Now enrich each transaction (will use cached data)
  return Promise.all(
    transactions.map((tx) => enrichTokenMetadata(tokenFetcher, tx)),
  );
}

async function enrichNftClassification(
  rpcUrl: string,
  classified: ClassifiedTransaction,
): Promise<ClassifiedTransaction> {
  const { classification } = classified;

  if (!NFT_TRANSACTION_TYPES.includes(classification.primaryType as any)) {
    return classified;
  }

  const nftMint = classification.metadata?.nft_mint as string | undefined;
  if (!nftMint) {
    return classified;
  }

  const nftData = await fetchNftMetadata(rpcUrl, nftMint);
  if (!nftData) {
    return classified;
  }

  return {
    ...classified,
    classification: {
      ...classification,
      metadata: {
        ...classification.metadata,
        nft_name: nftData.name,
        nft_image: nftData.image,
        nft_cdn_image: nftData.cdnImage,
        nft_collection: nftData.collection,
        nft_symbol: nftData.symbol,
        nft_attributes: nftData.attributes,
      },
    },
  };
}

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
  enrichNftMetadata?: boolean;
  /**
   * Enrich token metadata from Jupiter API.
   * Replaces "Unknown Token" placeholders with actual token names/symbols/logos.
   * Defaults to true.
   */
  enrichTokenMetadata?: boolean;
  /**
   * Include transactions from token accounts (ATAs) in addition to the wallet address.
   * This captures incoming token transfers that only reference the ATA, not the wallet.
   * Defaults to true.
   */
  includeTokenAccounts?: boolean;
}

export interface GetTransactionOptions {
  enrichNftMetadata?: boolean;
  /**
   * Enrich token metadata from Jupiter API.
   * Replaces "Unknown Token" placeholders with actual token names/symbols/logos.
   * Defaults to true.
   */
  enrichTokenMetadata?: boolean;
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
    tokenMints?: readonly string[],
  ): Promise<WalletBalance>;

  getTransactions(
    walletAddress: Address,
    options?: GetTransactionsOptions,
  ): Promise<ClassifiedTransaction[]>;

  getTransaction(
    signature: Signature,
    options?: GetTransactionOptions,
  ): Promise<ClassifiedTransaction | null>;

  getRawTransaction(signature: Signature): Promise<RawTransaction | null>;

  getNftMetadata(mintAddress: string): Promise<NftMetadata | null>;

  getNftMetadataBatch(
    mintAddresses: string[],
  ): Promise<Map<string, NftMetadata>>;
}

export function createIndexer(options: TxIndexerOptions): TxIndexer {
  const rpcUrl = "client" in options ? "" : options.rpcUrl;
  const client =
    "client" in options
      ? options.client
      : createSolanaClient(options.rpcUrl, options.wsUrl);

  // Create a shared token fetcher for this indexer instance
  const tokenFetcher = createTokenFetcher();

  return {
    rpc: client.rpc,

    async getBalance(
      walletAddress: Address,
      tokenMints?: readonly string[],
    ): Promise<WalletBalance> {
      return fetchWalletBalance(client.rpc, walletAddress, tokenMints);
    },

    async getTransactions(
      walletAddress: Address,
      options: GetTransactionsOptions = {},
    ): Promise<ClassifiedTransaction[]> {
      const {
        limit = 10,
        before,
        until,
        filterSpam = true,
        spamConfig,
        enrichNftMetadata = true,
        enrichTokenMetadata: enrichTokens = true,
        includeTokenAccounts = true,
      } = options;

      // Choose the appropriate signature fetcher based on includeTokenAccounts option
      const fetchSignatures = includeTokenAccounts
        ? fetchWalletAndTokenSignatures
        : fetchWalletSignatures;

      async function enrichBatch(
        transactions: ClassifiedTransaction[],
      ): Promise<ClassifiedTransaction[]> {
        let result = transactions;

        // Enrich token metadata first
        if (enrichTokens) {
          result = await enrichTokenMetadataBatch(tokenFetcher, result);
        }

        // Then enrich NFT metadata
        if (enrichNftMetadata && rpcUrl) {
          const nftMints = result
            .filter((t) =>
              NFT_TRANSACTION_TYPES.includes(
                t.classification.primaryType as any,
              ),
            )
            .map((t) => t.classification.metadata?.nft_mint as string)
            .filter(Boolean);

          if (nftMints.length > 0) {
            const nftMetadataMap = await fetchNftMetadataBatch(
              rpcUrl,
              nftMints,
            );

            result = result.map((t) => {
              const nftMint = t.classification.metadata?.nft_mint as
                | string
                | undefined;
              if (!nftMint || !nftMetadataMap.has(nftMint)) {
                return t;
              }

              const nftData = nftMetadataMap.get(nftMint)!;
              return {
                ...t,
                classification: {
                  ...t.classification,
                  metadata: {
                    ...t.classification.metadata,
                    nft_name: nftData.name,
                    nft_image: nftData.image,
                    nft_cdn_image: nftData.cdnImage,
                    nft_collection: nftData.collection,
                    nft_symbol: nftData.symbol,
                    nft_attributes: nftData.attributes,
                  },
                },
              };
            });
          }
        }

        return result;
      }

      if (!filterSpam) {
        const signatures = await fetchSignatures(client.rpc, walletAddress, {
          limit,
          before,
          until,
        });

        if (signatures.length === 0) {
          return [];
        }

        const signatureObjects = signatures.map((sig) =>
          parseSignature(sig.signature),
        );
        const transactions = await fetchTransactionsBatch(
          client.rpc,
          signatureObjects,
        );

        const walletAddressStr = walletAddress.toString();
        const classified = transactions.map((tx) => {
          tx.protocol = detectProtocol(tx.programIds);
          const legs = transactionToLegs(tx);
          const classification = classifyTransaction(
            legs,
            tx,
            walletAddressStr,
          );
          return { tx, classification, legs };
        });

        return enrichBatch(classified);
      }

      const accumulated: ClassifiedTransaction[] = [];
      let currentBefore = before;
      const MAX_ITERATIONS = 10;
      let iteration = 0;
      const walletAddressStr = walletAddress.toString();

      while (accumulated.length < limit && iteration < MAX_ITERATIONS) {
        iteration++;

        const batchSize = iteration === 1 ? limit : limit * 2;

        const signatures = await fetchSignatures(client.rpc, walletAddress, {
          limit: batchSize,
          before: currentBefore,
          until,
        });

        if (signatures.length === 0) {
          break;
        }

        const signatureObjects = signatures.map((sig) =>
          parseSignature(sig.signature),
        );
        const transactions = await fetchTransactionsBatch(
          client.rpc,
          signatureObjects,
        );

        const classified = transactions.map((tx) => {
          tx.protocol = detectProtocol(tx.programIds);
          const legs = transactionToLegs(tx);
          const classification = classifyTransaction(
            legs,
            tx,
            walletAddressStr,
          );
          return { tx, classification, legs };
        });

        const nonSpam = filterSpamTransactions(
          classified,
          spamConfig,
          walletAddressStr,
        );
        accumulated.push(...nonSpam);

        const lastSignature = signatures[signatures.length - 1];
        if (lastSignature) {
          currentBefore = parseSignature(lastSignature.signature);
        } else {
          break;
        }
      }

      const result = accumulated.slice(0, limit);
      return enrichBatch(result);
    },

    async getTransaction(
      signature: Signature,
      options: GetTransactionOptions = {},
    ): Promise<ClassifiedTransaction | null> {
      const {
        enrichNftMetadata = true,
        enrichTokenMetadata: enrichTokens = true,
      } = options;

      const tx = await fetchTransaction(client.rpc, signature);

      if (!tx) {
        return null;
      }

      tx.protocol = detectProtocol(tx.programIds);

      const legs = transactionToLegs(tx);
      const classification = classifyTransaction(legs, tx);

      let classified: ClassifiedTransaction = { tx, classification, legs };

      // Enrich token metadata
      if (enrichTokens) {
        classified = await enrichTokenMetadata(tokenFetcher, classified);
      }

      // Enrich NFT metadata
      if (enrichNftMetadata && rpcUrl) {
        classified = await enrichNftClassification(rpcUrl, classified);
      }

      return classified;
    },

    async getRawTransaction(
      signature: Signature,
    ): Promise<RawTransaction | null> {
      return fetchTransaction(client.rpc, signature);
    },

    async getNftMetadata(mintAddress: string): Promise<NftMetadata | null> {
      if (!rpcUrl) {
        throw new Error("getNftMetadata requires rpcUrl to be set");
      }
      return fetchNftMetadata(rpcUrl, mintAddress);
    },

    async getNftMetadataBatch(
      mintAddresses: string[],
    ): Promise<Map<string, NftMetadata>> {
      if (!rpcUrl) {
        throw new Error("getNftMetadataBatch requires rpcUrl to be set");
      }
      return fetchNftMetadataBatch(rpcUrl, mintAddresses);
    },
  };
}

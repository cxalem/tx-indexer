import type { Address, Signature } from "@solana/kit";
import {
  createSolanaClient,
  parseSignature,
  type SolanaClient,
} from "@tx-indexer/solana/rpc/client";
import { fetchWalletBalance } from "@tx-indexer/solana/fetcher/balances";
import {
  fetchWalletSignaturesPaged,
  fetchWalletTokenAccounts,
  fetchTokenAccountSignaturesThrottled,
  fetchTransaction,
  fetchTransactionsBatch,
} from "@tx-indexer/solana/fetcher/transactions";
import type { RetryConfig } from "@tx-indexer/solana/rpc/retry";

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

async function enrichTokenMetadata(
  tokenFetcher: TokenFetcher,
  classified: ClassifiedTransaction,
): Promise<ClassifiedTransaction> {
  const mints = new Set<string>();
  const decimalsMap = new Map<string, number>();

  for (const leg of classified.legs) {
    const mint = leg.amount.token.mint;
    mints.add(mint);
    decimalsMap.set(mint, leg.amount.token.decimals);
  }

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

  const tokenInfoMap = await tokenFetcher.getTokens(
    Array.from(mints),
    9, // default decimals
  );

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
        decimals: amount.token.decimals,
      },
    };
  }

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

  const enrichedLegs = classified.legs.map(enrichLeg);
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

async function enrichTokenMetadataBatch(
  tokenFetcher: TokenFetcher,
  transactions: ClassifiedTransaction[],
): Promise<ClassifiedTransaction[]> {
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

  await tokenFetcher.getTokens(Array.from(mints));

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
  enrichTokenMetadata?: boolean;
  includeTokenAccounts?: boolean;
  maxIterations?: number;
  signatureConcurrency?: number;
  transactionConcurrency?: number;
  retry?: RetryConfig;
}

export interface GetTransactionOptions {
  enrichNftMetadata?: boolean;
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
        // Disabled by default - wallet address signatures already capture most transfers
        // and this saves 20+ RPC calls per request for wallets with many token accounts
        includeTokenAccounts = false,
        maxIterations = 5,
        signatureConcurrency = 2,
        transactionConcurrency = 3,
        retry,
      } = options;

      const walletAddressStr = walletAddress.toString();
      const seenSignatures = new Set<string>();
      let cachedTokenAccounts: Address[] | null = null;

      async function enrichBatch(
        transactions: ClassifiedTransaction[],
      ): Promise<ClassifiedTransaction[]> {
        let result = transactions;

        if (enrichTokens) {
          result = await enrichTokenMetadataBatch(tokenFetcher, result);
        }

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

      function classifyBatch(
        transactions: RawTransaction[],
      ): ClassifiedTransaction[] {
        return transactions.map((tx) => {
          tx.protocol = detectProtocol(tx.programIds);
          const legs = transactionToLegs(tx, walletAddressStr);
          const classification = classifyTransaction(
            legs,
            tx,
            walletAddressStr,
          );
          return { tx, classification, legs };
        });
      }

      function sortByBlockTime(
        txs: ClassifiedTransaction[],
      ): ClassifiedTransaction[] {
        return txs.sort((a, b) => {
          const timeA = a.tx.blockTime ? Number(a.tx.blockTime) : 0;
          const timeB = b.tx.blockTime ? Number(b.tx.blockTime) : 0;
          return timeB - timeA;
        });
      }

      function dedupeSignatures(
        signatures: RawTransaction[],
      ): RawTransaction[] {
        const result: RawTransaction[] = [];
        for (const sig of signatures) {
          if (!seenSignatures.has(sig.signature)) {
            seenSignatures.add(sig.signature);
            result.push(sig);
          }
        }
        return result;
      }

      async function fetchAndClassify(
        signatures: RawTransaction[],
      ): Promise<ClassifiedTransaction[]> {
        if (signatures.length === 0) return [];

        const signatureObjects = signatures.map((sig) =>
          parseSignature(sig.signature),
        );
        const transactions = await fetchTransactionsBatch(
          client.rpc,
          signatureObjects,
          {
            concurrency: transactionConcurrency,
            retry,
          },
        );

        return classifyBatch(transactions);
      }

      async function accumulateUntilLimit(): Promise<ClassifiedTransaction[]> {
        const accumulated: ClassifiedTransaction[] = [];
        let currentBefore = before;
        let iteration = 0;
        let walletExhausted = false;
        let ataExhausted = false;
        let ataBefore = before;

        while (accumulated.length < limit && iteration < maxIterations) {
          iteration++;

          const needed = limit - accumulated.length;
          const pageSize = Math.max(needed * 2, 20);

          if (!walletExhausted) {
            const walletSigs = await fetchWalletSignaturesPaged(
              client.rpc,
              walletAddress,
              { pageSize, before: currentBefore, until, retry },
            );

            if (walletSigs.length === 0) {
              walletExhausted = true;
            } else {
              const newSigs = dedupeSignatures(walletSigs);
              if (newSigs.length > 0) {
                const classified = await fetchAndClassify(newSigs);
                const nonSpam = filterSpam
                  ? filterSpamTransactions(
                      classified,
                      spamConfig,
                      walletAddressStr,
                    )
                  : classified;
                accumulated.push(...nonSpam);

                const lastSig = walletSigs[walletSigs.length - 1];
                if (lastSig) {
                  currentBefore = parseSignature(lastSig.signature);
                }
              }

              if (walletSigs.length < pageSize) {
                walletExhausted = true;
              }
            }
          }

          if (accumulated.length >= limit) break;

          if (includeTokenAccounts && walletExhausted && !ataExhausted) {
            if (!cachedTokenAccounts) {
              cachedTokenAccounts = await fetchWalletTokenAccounts(
                client.rpc,
                walletAddress,
                retry,
              );
            }

            if (cachedTokenAccounts.length === 0) {
              ataExhausted = true;
            } else {
              const ataSigs = await fetchTokenAccountSignaturesThrottled(
                client.rpc,
                cachedTokenAccounts,
                {
                  concurrency: signatureConcurrency,
                  limit: pageSize,
                  before: ataBefore,
                  until,
                  retry,
                },
              );

              if (ataSigs.length === 0) {
                ataExhausted = true;
              } else {
                const newSigs = dedupeSignatures(ataSigs);
                if (newSigs.length > 0) {
                  const classified = await fetchAndClassify(newSigs);
                  const nonSpam = filterSpam
                    ? filterSpamTransactions(
                        classified,
                        spamConfig,
                        walletAddressStr,
                      )
                    : classified;
                  accumulated.push(...nonSpam);

                  const lastSig = ataSigs[ataSigs.length - 1];
                  if (lastSig) {
                    ataBefore = parseSignature(lastSig.signature);
                  }
                }

                if (ataSigs.length < pageSize) {
                  ataExhausted = true;
                }
              }
            }
          }

          if (walletExhausted && (!includeTokenAccounts || ataExhausted)) {
            break;
          }
        }

        return sortByBlockTime(accumulated).slice(0, limit);
      }

      const result = await accumulateUntilLimit();
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

      if (enrichTokens) {
        classified = await enrichTokenMetadata(tokenFetcher, classified);
      }

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

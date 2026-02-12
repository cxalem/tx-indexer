import type { Address, Signature, Rpc } from "@solana/kit";
import {
  createSolanaClient,
  parseAddress,
  parseSignature,
  type IndexerRpcApi,
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
import type { Cluster } from "@tx-indexer/core/core/network.types";
import {
  createTokenFetcher,
  type TokenFetcher,
} from "@tx-indexer/core/money/token-fetcher";
import {
  fetchNftMetadata,
  fetchNftMetadataBatch,
  type NftMetadata,
} from "./nft";
import { ConfigurationError } from "./errors";
import {
  DEFAULT_HELIUS_WALLET_API_BASE_URL,
  fetchWalletFundingSource,
  type WalletFundingSource,
} from "./wallet-api";

export type { WalletFundingSource } from "./wallet-api";

const NFT_TRANSACTION_TYPES = ["nft_mint", "nft_purchase", "nft_sale"] as const;

/**
 * Normalizes an address input to the branded Address type.
 * If already an Address, returns as-is. If string, parses it.
 */
function normalizeAddress(input: AddressInput): Address {
  return typeof input === "string" ? parseAddress(input) : input;
}

/**
 * Normalizes a signature input to the branded Signature type.
 * If already a Signature, returns as-is. If string, parses it.
 */
function normalizeSignature(input: SignatureInput): Signature {
  return typeof input === "string" ? parseSignature(input) : input;
}

/**
 * Normalizes an optional signature input.
 * Returns undefined if input is undefined, otherwise normalizes to Signature.
 */
function normalizeOptionalSignature(
  input: SignatureInput | undefined,
): Signature | undefined {
  return input === undefined ? undefined : normalizeSignature(input);
}

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

/**
 * Base options shared across all indexer configurations.
 */
interface TxIndexerBaseOptions {
  /**
   * The Solana cluster to use for token resolution.
   * - "mainnet-beta": Uses Jupiter API and mainnet token registry (default)
   * - "devnet": Uses devnet token registry, skips Jupiter API
   * - "testnet": Uses devnet token registry, skips Jupiter API
   *
   * @default "mainnet-beta"
   *
   * @example
   * ```typescript
   * // Devnet indexer
   * const indexer = createIndexer({
   *   rpcUrl: "https://api.devnet.solana.com",
   *   cluster: "devnet",
   * });
   * ```
   */
  cluster?: Cluster;

  /**
   * Custom token metadata to use for token resolution.
   * These tokens take priority over built-in registries and Jupiter API.
   * Useful for custom tokens, test tokens, or overriding metadata.
   *
   * @example
   * ```typescript
   * const indexer = createIndexer({
   *   rpcUrl: "https://api.devnet.solana.com",
   *   cluster: "devnet",
   *   customTokens: {
   *     "MyTokenMintAddress...": {
   *       mint: "MyTokenMintAddress...",
   *       symbol: "TEST",
   *       name: "Test Token",
   *       decimals: 9,
   *     },
   *   },
   * });
   * ```
   */
  customTokens?: Record<string, TokenInfo>;

  /**
   * Helius API key used for Wallet API endpoints such as getWalletFundingSource().
   *
   * @example
   * ```typescript
   * const indexer = createIndexer({
   *   rpcUrl: "https://api.mainnet-beta.solana.com",
   *   heliusApiKey: process.env.HELIUS_API_KEY,
   * });
   * ```
   */
  heliusApiKey?: string;

  /**
   * Base URL for the Helius Wallet API.
   *
   * @default "https://api.helius.xyz/v1"
   */
  heliusWalletApiBaseUrl?: string;

  /**
   * Cache TTL for successful wallet funding lookups, in milliseconds.
   *
   * @default 86400000 (24 hours)
   */
  walletFundingCacheTtlMs?: number;

  /**
   * Cache TTL for "not found" wallet funding lookups, in milliseconds.
   *
   * @default 3600000 (1 hour)
   */
  walletFundingNotFoundCacheTtlMs?: number;
}

/**
 * Minimal client interface required by the indexer.
 * Any client that provides an RPC with the required methods can be used.
 * This allows integration with custom Solana clients (e.g., from @solana/react-core).
 */
export interface IndexerClient {
  rpc: Rpc<IndexerRpcApi>;
}

export type TxIndexerOptions =
  | (TxIndexerBaseOptions & {
      rpcUrl: string;
      wsUrl?: string;
    })
  | (TxIndexerBaseOptions & {
      client: IndexerClient;
    });

export interface GetTransactionsOptions {
  limit?: number;
  /** Fetch transactions before this signature (pagination) */
  before?: SignatureInput;
  /** Fetch transactions until this signature (exclusive) */
  until?: SignatureInput;
  filterSpam?: boolean;
  spamConfig?: SpamFilterConfig;
  enrichNftMetadata?: boolean;
  enrichTokenMetadata?: boolean;
  includeTokenAccounts?: boolean;
  maxIterations?: number;
  signatureConcurrency?: number;
  transactionConcurrency?: number;
  retry?: RetryConfig;
  /**
   * Multiplier for signature overfetch (default: 2).
   * Higher values fetch more signatures per iteration to account for spam filtering.
   * Lower values reduce RPC calls but may require more iterations.
   * Set to 1 for minimal overfetch (useful with rate-limited RPCs).
   */
  overfetchMultiplier?: number;
  /**
   * Minimum signatures to fetch per iteration (default: 20).
   * Set lower for rate-limited RPCs.
   */
  minPageSize?: number;
  /**
   * Maximum number of token accounts to query for signatures (default: 5).
   * Lower values reduce RPC calls but may miss some incoming transfers.
   * Set to 0 to skip token account queries entirely.
   */
  maxTokenAccounts?: number;
}

export interface GetTransactionOptions {
  enrichNftMetadata?: boolean;
  enrichTokenMetadata?: boolean;
}

export interface GetWalletFundingSourceOptions {
  /**
   * Override Helius API key for this call.
   * If omitted, falls back to createIndexer({ heliusApiKey }).
   */
  heliusApiKey?: string;
  /** Override Wallet API base URL for this call. */
  heliusWalletApiBaseUrl?: string;
  /** Timeout in milliseconds for this call. */
  timeoutMs?: number;
  /** Retry configuration for network/rate-limit/transient failures. */
  retry?: RetryConfig;
  /** Bypass in-memory cache and force a fresh request. */
  forceRefresh?: boolean;
}

// =============================================================================
// EXPERIMENTAL: Signatures-First API Types
// =============================================================================

/**
 * @experimental Lightweight signature information returned by getSignatures().
 * Contains only metadata, not full transaction details.
 *
 * @remarks
 * This is part of the experimental signatures-first API. The shape and behavior
 * may change in future versions.
 */
export interface SignatureInfo {
  /** Transaction signature */
  signature: string;
  /** Slot number */
  slot: bigint;
  /** Block timestamp (Unix seconds), null if not available */
  blockTime: bigint | null;
  /** Error if transaction failed, null if successful */
  err: unknown | null;
  /** Memo if present */
  memo: string | null;
}

/**
 * @experimental Options for getSignatures().
 */
export interface GetSignaturesOptions {
  /** Maximum number of signatures to return (default: 100) */
  limit?: number;
  /** Fetch signatures before this signature (pagination) */
  before?: SignatureInput;
  /** Fetch signatures until this signature (exclusive) */
  until?: SignatureInput;
  /**
   * Include signatures from token accounts (ATAs).
   * This catches incoming token transfers that don't appear on the wallet address.
   * Default: false (faster, but may miss incoming token transfers)
   */
  includeTokenAccounts?: boolean;
  /** Maximum token accounts to query (default: 5) */
  maxTokenAccounts?: number;
  /** Retry configuration */
  retry?: RetryConfig;
}

/**
 * @experimental Result from getSignatures().
 */
export interface GetSignaturesResult {
  /** Array of signature metadata, sorted by slot (newest first) */
  signatures: SignatureInfo[];
  /** The oldest signature in the result (for pagination) */
  oldestSignature: string | null;
  /** Whether there are more signatures to fetch */
  hasMore: boolean;
}

/**
 * @experimental Options for getTransactionsBySignatures().
 */
export interface GetTransactionsBySignaturesOptions {
  /** Filter out spam transactions (default: true) */
  filterSpam?: boolean;
  /** Spam filter configuration */
  spamConfig?: SpamFilterConfig;
  /** Enrich NFT metadata (default: true) */
  enrichNftMetadata?: boolean;
  /** Enrich token metadata (default: true) */
  enrichTokenMetadata?: boolean;
  /** Concurrency for fetching transactions (default: 3) */
  concurrency?: number;
  /** Retry configuration */
  retry?: RetryConfig;
  /**
   * Callback to check if a signature is already cached.
   * Return the cached ClassifiedTransaction if available, null otherwise.
   * This enables integration with external caches.
   */
  getCached?: (signature: string) => Promise<ClassifiedTransaction | null>;
  /**
   * Callback to cache a newly fetched and classified transaction.
   * Called for each transaction that was fetched from RPC.
   */
  onFetched?: (tx: ClassifiedTransaction) => void;
}

export interface ClassifiedTransaction {
  tx: RawTransaction;
  classification: TransactionClassification;
  legs: ReturnType<typeof transactionToLegs>;
}

/**
 * Input type that accepts both branded Address type and plain string.
 * Strings are automatically parsed and validated.
 */
export type AddressInput = Address | string;

/**
 * Input type that accepts both branded Signature type and plain string.
 * Strings are automatically parsed and validated.
 */
export type SignatureInput = Signature | string;

export interface TxIndexer {
  rpc: ReturnType<typeof createSolanaClient>["rpc"];

  /**
   * Get the balance of a wallet including SOL and token balances.
   *
   * @param walletAddress - Wallet address (string or Address type)
   * @param tokenMints - Optional list of specific token mints to include
   * @returns Wallet balance with SOL and token amounts
   *
   * @example
   * ```typescript
   * // With string
   * const balance = await indexer.getBalance("YourWalletAddress...");
   *
   * // With Address type
   * import { parseAddress } from "tx-indexer";
   * const balance = await indexer.getBalance(parseAddress("YourWalletAddress..."));
   * ```
   */
  getBalance(
    walletAddress: AddressInput,
    tokenMints?: readonly string[],
  ): Promise<WalletBalance>;

  /**
   * Get classified transactions for a wallet.
   *
   * @param walletAddress - Wallet address (string or Address type)
   * @param options - Pagination and filtering options
   * @returns Array of classified transactions, newest first
   *
   * @example
   * ```typescript
   * const txs = await indexer.getTransactions("YourWalletAddress...", {
   *   limit: 10,
   *   filterSpam: true,
   * });
   * ```
   */
  getTransactions(
    walletAddress: AddressInput,
    options?: GetTransactionsOptions,
  ): Promise<ClassifiedTransaction[]>;

  /**
   * Get a single classified transaction by signature.
   *
   * @param signature - Transaction signature (string or Signature type)
   * @param options - Enrichment options
   * @returns Classified transaction or null if not found
   *
   * @example
   * ```typescript
   * const tx = await indexer.getTransaction("5abc123...");
   * if (tx) {
   *   console.log(tx.classification.primaryType);
   * }
   * ```
   */
  getTransaction(
    signature: SignatureInput,
    options?: GetTransactionOptions,
  ): Promise<ClassifiedTransaction | null>;

  /**
   * Get raw transaction data without classification.
   *
   * @param signature - Transaction signature (string or Signature type)
   * @returns Raw transaction or null if not found
   */
  getRawTransaction(signature: SignatureInput): Promise<RawTransaction | null>;

  /**
   * Get NFT metadata from DAS RPC.
   *
   * @param mintAddress - NFT mint address
   * @returns NFT metadata or null if not found
   * @throws Error if rpcUrl was not provided (using client option)
   */
  getNftMetadata(mintAddress: string): Promise<NftMetadata | null>;

  /**
   * Get NFT metadata for multiple mints in batch.
   *
   * @param mintAddresses - Array of NFT mint addresses
   * @returns Map of mint address to metadata
   * @throws Error if rpcUrl was not provided (using client option)
   */
  getNftMetadataBatch(
    mintAddresses: string[],
  ): Promise<Map<string, NftMetadata>>;

  /**
   * Get the first SOL funding source for a wallet via Helius Wallet API.
   *
   * @param walletAddress - Wallet address (string or Address type)
   * @param options - Optional API key/base URL overrides, timeout, retry, cache controls
   * @returns Funding source data, or null if no funding transaction exists
   *
   * @remarks
   * - This endpoint returns the first incoming SOL transfer only.
   * - The funder is the immediate source, not the ultimate source of funds.
   * - Wallet API is currently beta and may evolve.
   */
  getWalletFundingSource(
    walletAddress: AddressInput,
    options?: GetWalletFundingSourceOptions,
  ): Promise<WalletFundingSource | null>;

  // ===========================================================================
  // EXPERIMENTAL: Signatures-First API
  // ===========================================================================

  /**
   * @experimental Get transaction signatures for a wallet without fetching full details.
   *
   * This is a lightweight alternative to getTransactions() that only fetches
   * signature metadata. Use this when you need to:
   * - Browse transaction history efficiently
   * - Implement custom pagination
   * - Check which transactions exist before fetching details
   * - Reduce RPC calls in rate-limited environments
   *
   * Follow up with getTransactionsBySignatures() to fetch details for specific
   * signatures.
   *
   * @param walletAddress - Wallet address (string or Address type)
   * @param options - Pagination and filtering options
   * @returns Signature metadata and pagination info
   *
   * @remarks
   * This API is experimental and may change in future versions.
   *
   * @example
   * ```typescript
   * // Get first page of signatures
   * const result = await indexer.getSignatures("YourWallet...", { limit: 50 });
   *
   * // Get next page
   * if (result.hasMore && result.oldestSignature) {
   *   const nextPage = await indexer.getSignatures("YourWallet...", {
   *     limit: 50,
   *     before: result.oldestSignature,
   *   });
   * }
   * ```
   */
  getSignatures(
    walletAddress: AddressInput,
    options?: GetSignaturesOptions,
  ): Promise<GetSignaturesResult>;

  /**
   * @experimental Fetch classified transactions for specific signatures.
   *
   * Use this after getSignatures() to fetch full transaction details only
   * for the signatures you need. This enables efficient pagination and
   * selective loading.
   *
   * Integrates with external caches via getCached/onFetched callbacks.
   *
   * @param signatures - Array of signatures to fetch (string or Signature type)
   * @param walletAddress - Wallet address for classification context
   * @param options - Enrichment and caching options
   * @returns Array of classified transactions
   *
   * @remarks
   * This API is experimental and may change in future versions.
   *
   * @example
   * ```typescript
   * // Fetch details for specific signatures
   * const txs = await indexer.getTransactionsBySignatures(
   *   ["sig1...", "sig2...", "sig3..."],
   *   "YourWallet...",
   *   {
   *     // Skip signatures already in your cache
   *     getCached: async (sig) => myCache.get(sig),
   *     // Cache newly fetched transactions
   *     onFetched: (tx) => myCache.set(tx.tx.signature, tx),
   *   }
   * );
   * ```
   */
  getTransactionsBySignatures(
    signatures: SignatureInput[],
    walletAddress: AddressInput,
    options?: GetTransactionsBySignaturesOptions,
  ): Promise<ClassifiedTransaction[]>;
}

export function createIndexer(options: TxIndexerOptions): TxIndexer {
  const rpcUrl = "client" in options ? "" : options.rpcUrl;
  const client =
    "client" in options
      ? options.client
      : createSolanaClient(options.rpcUrl, options.wsUrl);

  // Extract cluster and customTokens from options
  const cluster = options.cluster ?? "mainnet-beta";
  const customTokens = options.customTokens;
  const heliusApiKey = options.heliusApiKey;
  const heliusWalletApiBaseUrl =
    options.heliusWalletApiBaseUrl ?? DEFAULT_HELIUS_WALLET_API_BASE_URL;
  const walletFundingCacheTtlMs =
    options.walletFundingCacheTtlMs ?? 24 * 60 * 60 * 1000;
  const walletFundingNotFoundCacheTtlMs =
    options.walletFundingNotFoundCacheTtlMs ?? 60 * 60 * 1000;

  const walletFundingCache = new Map<
    string,
    { value: WalletFundingSource | null; expiresAt: number }
  >();
  const walletFundingInflight = new Map<
    string,
    Promise<WalletFundingSource | null>
  >();

  const tokenFetcher = createTokenFetcher({
    cluster,
    customTokens,
  });

  return {
    rpc: client.rpc,

    async getBalance(
      walletAddress: AddressInput,
      tokenMints?: readonly string[],
    ): Promise<WalletBalance> {
      const address = normalizeAddress(walletAddress);
      return fetchWalletBalance(client.rpc, address, tokenMints);
    },

    async getTransactions(
      walletAddress: AddressInput,
      options: GetTransactionsOptions = {},
    ): Promise<ClassifiedTransaction[]> {
      const {
        limit = 10,
        before: beforeInput,
        until: untilInput,
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
        overfetchMultiplier = 2,
        minPageSize = 20,
        maxTokenAccounts = 5,
      } = options;

      // Normalize optional signature inputs
      const before = normalizeOptionalSignature(beforeInput);
      const until = normalizeOptionalSignature(untilInput);

      const normalizedAddress = normalizeAddress(walletAddress);
      const walletAddressStr = normalizedAddress.toString();
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
            // Enable JSON-RPC batching to reduce HTTP requests
            rpcUrl,
          },
        );

        return classifyBatch(transactions);
      }

      async function accumulateUntilLimit(): Promise<ClassifiedTransaction[]> {
        const accumulated: ClassifiedTransaction[] = [];
        let currentBefore = before;
        let iteration = 0;
        let walletExhausted = false;
        let ataExhausted = !includeTokenAccounts || maxTokenAccounts === 0;
        let ataBefore = before;

        // Pre-fetch token accounts list on first load if needed
        // This is 2 RPC calls (TOKEN_PROGRAM + TOKEN_2022_PROGRAM)
        if (
          includeTokenAccounts &&
          maxTokenAccounts > 0 &&
          !cachedTokenAccounts
        ) {
          cachedTokenAccounts = await fetchWalletTokenAccounts(
            client.rpc,
            normalizedAddress,
            retry,
          );
          if (cachedTokenAccounts.length === 0) {
            ataExhausted = true;
          }
        }

        while (accumulated.length < limit && iteration < maxIterations) {
          iteration++;

          const needed = limit - accumulated.length;
          const pageSize = Math.max(needed * overfetchMultiplier, minPageSize);

          // Fetch wallet signatures AND token account signatures in parallel
          // This ensures we see both outgoing AND incoming transactions
          const fetchPromises: Promise<RawTransaction[]>[] = [];

          if (!walletExhausted) {
            fetchPromises.push(
              fetchWalletSignaturesPaged(client.rpc, normalizedAddress, {
                pageSize,
                before: currentBefore,
                until,
                retry,
              }),
            );
          }

          if (
            !ataExhausted &&
            cachedTokenAccounts &&
            cachedTokenAccounts.length > 0
          ) {
            const limitedAccounts = cachedTokenAccounts.slice(
              0,
              maxTokenAccounts,
            );
            fetchPromises.push(
              fetchTokenAccountSignaturesThrottled(
                client.rpc,
                limitedAccounts,
                {
                  concurrency: signatureConcurrency,
                  limit: pageSize,
                  before: ataBefore,
                  until,
                  retry,
                },
              ),
            );
          }

          if (fetchPromises.length === 0) break;

          const results = await Promise.all(fetchPromises);

          // Process results and update cursors
          let resultIdx = 0;

          if (!walletExhausted) {
            const walletSigs = results[resultIdx++] || [];
            if (walletSigs.length === 0) {
              walletExhausted = true;
            } else {
              const lastSig = walletSigs[walletSigs.length - 1];
              if (lastSig) {
                currentBefore = parseSignature(lastSig.signature);
              }
              if (walletSigs.length < pageSize) {
                walletExhausted = true;
              }
            }
          }

          if (
            !ataExhausted &&
            cachedTokenAccounts &&
            cachedTokenAccounts.length > 0
          ) {
            const ataSigs = results[resultIdx] || [];
            if (ataSigs.length === 0) {
              ataExhausted = true;
            } else {
              const lastSig = ataSigs[ataSigs.length - 1];
              if (lastSig) {
                ataBefore = parseSignature(lastSig.signature);
              }
              if (ataSigs.length < pageSize) {
                ataExhausted = true;
              }
            }
          }

          // Merge, dedupe, classify
          const allSigs = results.flat();
          const newSigs = dedupeSignatures(allSigs);

          if (newSigs.length > 0) {
            const classified = await fetchAndClassify(newSigs);
            const nonSpam = filterSpam
              ? filterSpamTransactions(classified, spamConfig, walletAddressStr)
              : classified;
            accumulated.push(...nonSpam);
          }

          if (walletExhausted && ataExhausted) break;
        }

        return sortByBlockTime(accumulated).slice(0, limit);
      }

      const result = await accumulateUntilLimit();
      return enrichBatch(result);
    },

    async getTransaction(
      signature: SignatureInput,
      options: GetTransactionOptions = {},
    ): Promise<ClassifiedTransaction | null> {
      const {
        enrichNftMetadata = true,
        enrichTokenMetadata: enrichTokens = true,
      } = options;

      const normalizedSig = normalizeSignature(signature);
      const tx = await fetchTransaction(client.rpc, normalizedSig);

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
      signature: SignatureInput,
    ): Promise<RawTransaction | null> {
      const normalizedSig = normalizeSignature(signature);
      return fetchTransaction(client.rpc, normalizedSig);
    },

    async getNftMetadata(mintAddress: string): Promise<NftMetadata | null> {
      if (!rpcUrl) {
        throw new ConfigurationError(
          "getNftMetadata requires rpcUrl to be set. Use createIndexer({ rpcUrl }) instead of createIndexer({ client }).",
        );
      }
      return fetchNftMetadata(rpcUrl, mintAddress);
    },

    async getNftMetadataBatch(
      mintAddresses: string[],
    ): Promise<Map<string, NftMetadata>> {
      if (!rpcUrl) {
        throw new ConfigurationError(
          "getNftMetadataBatch requires rpcUrl to be set. Use createIndexer({ rpcUrl }) instead of createIndexer({ client }).",
        );
      }
      return fetchNftMetadataBatch(rpcUrl, mintAddresses);
    },

    async getWalletFundingSource(
      walletAddress: AddressInput,
      options: GetWalletFundingSourceOptions = {},
    ): Promise<WalletFundingSource | null> {
      const {
        heliusApiKey: overrideApiKey,
        heliusWalletApiBaseUrl: overrideBaseUrl,
        timeoutMs,
        retry,
        forceRefresh = false,
      } = options;

      const address = normalizeAddress(walletAddress).toString();
      const apiKey = overrideApiKey ?? heliusApiKey;

      if (!apiKey) {
        throw new ConfigurationError(
          "getWalletFundingSource requires a Helius API key. Set createIndexer({ heliusApiKey }) or pass options.heliusApiKey.",
        );
      }

      const baseUrl = overrideBaseUrl ?? heliusWalletApiBaseUrl;
      const cacheKey = `${baseUrl}:${address}`;
      const now = Date.now();

      if (!forceRefresh) {
        const cached = walletFundingCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
          return cached.value;
        }

        const inflight = walletFundingInflight.get(cacheKey);
        if (inflight) {
          return inflight;
        }
      }

      const request = fetchWalletFundingSource({
        walletAddress: address,
        apiKey,
        baseUrl,
        timeoutMs,
        retry,
      })
        .then((result) => {
          const ttl = result
            ? walletFundingCacheTtlMs
            : walletFundingNotFoundCacheTtlMs;
          walletFundingCache.set(cacheKey, {
            value: result,
            expiresAt: Date.now() + ttl,
          });
          return result;
        })
        .finally(() => {
          walletFundingInflight.delete(cacheKey);
        });

      walletFundingInflight.set(cacheKey, request);
      return request;
    },

    // =========================================================================
    // EXPERIMENTAL: Signatures-First API Implementation
    // =========================================================================

    async getSignatures(
      walletAddress: AddressInput,
      options: GetSignaturesOptions = {},
    ): Promise<GetSignaturesResult> {
      const {
        limit = 100,
        before: beforeInput,
        until: untilInput,
        includeTokenAccounts = false,
        maxTokenAccounts = 5,
        retry,
      } = options;

      // Normalize optional signature inputs
      const before = normalizeOptionalSignature(beforeInput);
      const until = normalizeOptionalSignature(untilInput);

      const normalizedAddress = normalizeAddress(walletAddress);
      const seenSignatures = new Set<string>();
      const allSignatures: SignatureInfo[] = [];

      // Fetch wallet signatures
      const walletSigs = await fetchWalletSignaturesPaged(
        client.rpc,
        normalizedAddress,
        { pageSize: limit, before, until, retry },
      );

      for (const sig of walletSigs) {
        const sigStr = String(sig.signature);
        if (!seenSignatures.has(sigStr)) {
          seenSignatures.add(sigStr);
          allSignatures.push({
            signature: sigStr,
            slot: typeof sig.slot === "bigint" ? sig.slot : BigInt(sig.slot),
            blockTime: sig.blockTime
              ? typeof sig.blockTime === "bigint"
                ? sig.blockTime
                : BigInt(sig.blockTime)
              : null,
            err: sig.err,
            memo: sig.memo ?? null,
          });
        }
      }

      // Optionally fetch token account signatures
      if (includeTokenAccounts && maxTokenAccounts > 0) {
        const tokenAccounts = await fetchWalletTokenAccounts(
          client.rpc,
          normalizedAddress,
          retry,
        );

        if (tokenAccounts.length > 0) {
          const limitedAccounts = tokenAccounts.slice(0, maxTokenAccounts);
          const ataSigs = await fetchTokenAccountSignaturesThrottled(
            client.rpc,
            limitedAccounts,
            { limit, before, until, retry },
          );

          for (const sig of ataSigs) {
            const sigStr = String(sig.signature);
            if (!seenSignatures.has(sigStr)) {
              seenSignatures.add(sigStr);
              allSignatures.push({
                signature: sigStr,
                slot:
                  typeof sig.slot === "bigint" ? sig.slot : BigInt(sig.slot),
                blockTime: sig.blockTime
                  ? typeof sig.blockTime === "bigint"
                    ? sig.blockTime
                    : BigInt(sig.blockTime)
                  : null,
                err: sig.err,
                memo: sig.memo ?? null,
              });
            }
          }
        }
      }

      // Sort by slot (newest first) and limit
      const sorted = allSignatures
        .sort((a, b) => (b.slot > a.slot ? 1 : b.slot < a.slot ? -1 : 0))
        .slice(0, limit);

      const oldestSignature =
        sorted.length > 0
          ? (sorted[sorted.length - 1]?.signature ?? null)
          : null;

      // hasMore is true if we got exactly `limit` results (there might be more)
      const hasMore = sorted.length === limit;

      return {
        signatures: sorted,
        oldestSignature,
        hasMore,
      };
    },

    async getTransactionsBySignatures(
      signatures: SignatureInput[],
      walletAddress: AddressInput,
      options: GetTransactionsBySignaturesOptions = {},
    ): Promise<ClassifiedTransaction[]> {
      const {
        filterSpam = true,
        spamConfig,
        enrichNftMetadata = true,
        enrichTokenMetadata: enrichTokens = true,
        concurrency = 3,
        retry,
        getCached,
        onFetched,
      } = options;

      if (signatures.length === 0) {
        return [];
      }

      const walletAddressStr = normalizeAddress(walletAddress).toString();
      const results: ClassifiedTransaction[] = [];
      const sigsToFetch: Signature[] = [];

      // Check cache for each signature
      if (getCached) {
        for (const sig of signatures) {
          const sigStr = String(sig);
          const cached = await getCached(sigStr);
          if (cached) {
            results.push(cached);
          } else {
            sigsToFetch.push(normalizeSignature(sig));
          }
        }
      } else {
        // No cache, fetch all
        sigsToFetch.push(...signatures.map(normalizeSignature));
      }

      // Fetch and classify missing transactions
      if (sigsToFetch.length > 0) {
        const rawTxs = await fetchTransactionsBatch(client.rpc, sigsToFetch, {
          concurrency,
          retry,
          rpcUrl,
        });

        for (const tx of rawTxs) {
          tx.protocol = detectProtocol(tx.programIds);
          const legs = transactionToLegs(tx, walletAddressStr);
          const classification = classifyTransaction(
            legs,
            tx,
            walletAddressStr,
          );
          let classified: ClassifiedTransaction = { tx, classification, legs };

          // Enrich token metadata
          if (enrichTokens) {
            classified = await enrichTokenMetadata(tokenFetcher, classified);
          }

          // Enrich NFT metadata
          if (enrichNftMetadata && rpcUrl) {
            classified = await enrichNftClassification(rpcUrl, classified);
          }

          results.push(classified);

          // Notify cache callback
          onFetched?.(classified);
        }
      }

      // Apply spam filter
      let finalResults = results;
      if (filterSpam) {
        finalResults = filterSpamTransactions(
          results,
          spamConfig,
          walletAddressStr,
        );
      }

      // Sort by blockTime (newest first)
      return finalResults.sort((a, b) => {
        const timeA = a.tx.blockTime ? Number(a.tx.blockTime) : 0;
        const timeB = b.tx.blockTime ? Number(b.tx.blockTime) : 0;
        return timeB - timeA;
      });
    },
  };
}

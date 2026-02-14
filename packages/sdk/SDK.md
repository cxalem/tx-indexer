# tx-indexer SDK Documentation

## Package Information

| Property        | Value                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**        | `tx-indexer`                                                                                                                                     |
| **Version**     | `1.5.0`                                                                                                                                          |
| **Description** | A TypeScript SDK that transforms raw Solana transactions into human-readable financial data with automatic classification and protocol detection |
| **License**     | MIT                                                                                                                                              |
| **Author**      | cxalem                                                                                                                                           |
| **Homepage**    | https://itx-indexer.com/                                                                                                                         |
| **Repository**  | https://github.com/cxalem/tx-indexer.git                                                                                                         |

### Dependencies

- **Runtime**: `zod` ^4.1.13
- **Peer Dependencies**: `typescript` ^5, `@solana/kit` ^5.0.0

### Bundle Size

| Import                | Size (minified + brotli) |
| --------------------- | ------------------------ |
| Full SDK              | ~11 KB                   |
| `createIndexer` only  | ~11 KB                   |
| `classifyTransaction` | ~6 KB                    |

---

## Entry Points

The SDK provides three entry points:

```typescript
// Main API - stable, recommended for most users
import { createIndexer, parseAddress } from "tx-indexer";

// Advanced API - for power users needing low-level control
import { fetchTransaction, classifyTransaction } from "tx-indexer/advanced";

// Types only - for type declarations
import type { ClassifiedTransaction, TxLeg } from "tx-indexer/types";
```

---

## Exports by Category

### 1. Core Client API (from `tx-indexer`)

#### `createIndexer(options: TxIndexerOptions): TxIndexer`

Creates an indexer instance for fetching and classifying Solana transactions.

**Options:**

```typescript
type TxIndexerOptions =
  | { rpcUrl: string; wsUrl?: string } // Using RPC URL
  | { client: SolanaClient }; // Using custom client
```

**Returns:** `TxIndexer` interface with the following methods:

| Method                        | Signature                                                                                                        | Description                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `getBalance`                  | `(walletAddress: AddressInput, tokenMints?: readonly string[]) => Promise<WalletBalance>`                        | Get SOL and token balances for a wallet                            |
| `getTransactions`             | `(walletAddress: AddressInput, options?: GetTransactionsOptions) => Promise<ClassifiedTransaction[]>`            | Get classified transactions for a wallet                           |
| `getTransaction`              | `(signature: SignatureInput, options?: GetTransactionOptions) => Promise<ClassifiedTransaction \| null>`         | Get a single classified transaction                                |
| `getRawTransaction`           | `(signature: SignatureInput) => Promise<RawTransaction \| null>`                                                 | Get raw transaction without classification                         |
| `getNftMetadata`              | `(mintAddress: string) => Promise<NftMetadata \| null>`                                                          | Get NFT metadata (requires DAS RPC)                                |
| `getNftMetadataBatch`         | `(mintAddresses: string[]) => Promise<Map<string, NftMetadata>>`                                                 | Batch fetch NFT metadata                                           |
| `getWalletFundingSource`      | `(walletAddress: AddressInput, options?: GetWalletFundingSourceOptions) => Promise<WalletFundingSource \| null>` | Get first SOL funding source (requires Helius API key)             |
| `getSignatures`               | `(walletAddress: AddressInput, options?: GetSignaturesOptions) => Promise<GetSignaturesResult>`                  | **[EXPERIMENTAL]** Get transaction signatures without full details |
| `getTransactionsBySignatures` | `(signatures: SignatureInput[], walletAddress: AddressInput, options?) => Promise<ClassifiedTransaction[]>`      | **[EXPERIMENTAL]** Fetch transactions for specific signatures      |

#### GetTransactionsOptions

```typescript
interface GetTransactionsOptions {
  limit?: number; // Default: 10
  before?: Signature; // Pagination cursor
  until?: Signature; // Stop boundary
  filterSpam?: boolean; // Default: true
  spamConfig?: SpamFilterConfig;
  enrichNftMetadata?: boolean; // Default: true
  enrichTokenMetadata?: boolean; // Default: true
  includeTokenAccounts?: boolean; // Default: false
  maxIterations?: number; // Default: 5
  signatureConcurrency?: number; // Default: 2
  transactionConcurrency?: number; // Default: 3
  retry?: RetryConfig;
  overfetchMultiplier?: number; // Default: 2
  minPageSize?: number; // Default: 20
  maxTokenAccounts?: number; // Default: 5
}
```

#### GetTransactionOptions

```typescript
interface GetTransactionOptions {
  enrichNftMetadata?: boolean; // Default: true
  enrichTokenMetadata?: boolean; // Default: true
  walletAddress?: AddressInput; // Optional wallet perspective for direction-sensitive classification
}
```

### 2. Address/Signature Parsing

| Function         | Signature                          | Description                            |
| ---------------- | ---------------------------------- | -------------------------------------- |
| `parseAddress`   | `(address: string) => Address`     | Parse string to branded Address type   |
| `parseSignature` | `(signature: string) => Signature` | Parse string to branded Signature type |

### 3. Token Registry

| Export                  | Type                                            | Description                           |
| ----------------------- | ----------------------------------------------- | ------------------------------------- |
| `KNOWN_TOKENS`          | `Record<string, string>`                        | Well-known token mint addresses       |
| `TOKEN_INFO`            | `Record<string, TokenInfo>`                     | Static token metadata                 |
| `getTokenInfo`          | `(mint: string) => TokenInfo \| undefined`      | Get token info from registry          |
| `createUnknownToken`    | `(mint: string, decimals: number) => TokenInfo` | Create placeholder for unknown tokens |
| `SUPPORTED_STABLECOINS` | `string[]`                                      | Array of stablecoin mint addresses    |
| `LIQUID_STAKING_TOKENS` | `string[]`                                      | Array of LST mint addresses           |

**Known Tokens Include:**

- **Native**: SOL
- **Stablecoins**: USDC, USDT, PYUSD, USDG, USDC_BRIDGED, DAI
- **Major Tokens**: JUP, JTO, PYTH, BONK, WIF, RENDER, HNT, RAY, ORCA, MNGO
- **Liquid Staking**: MSOL, JITOSOL, BSOL
- **Memecoins**: POPCAT, MEW, PNUT, FARTCOIN, AI16Z
- **Wrapped**: WBTC, WETH

### 4. JSON Serialization

| Function                       | Signature                                                       | Description                       |
| ------------------------------ | --------------------------------------------------------------- | --------------------------------- |
| `toJsonClassifiedTransaction`  | `(tx: ClassifiedTransaction) => JsonClassifiedTransaction`      | Convert to JSON-safe format       |
| `toJsonClassifiedTransactions` | `(txs: ClassifiedTransaction[]) => JsonClassifiedTransaction[]` | Batch convert to JSON-safe format |

**JSON-Safe Types:**

- `JsonTokenInfo`, `JsonFiatValue`, `JsonMoneyAmount`
- `JsonTokenBalance`, `JsonProtocolInfo`, `JsonRawTransaction`
- `JsonCounterparty`, `JsonTransactionClassification`
- `JsonTxLeg`, `JsonClassifiedTransaction`

### 5. Error Types

| Error Class          | Code                  | Retryable | Description                                       |
| -------------------- | --------------------- | --------- | ------------------------------------------------- |
| `TxIndexerError`     | varies                | varies    | Base class for all SDK errors                     |
| `RateLimitError`     | `RATE_LIMIT`          | Yes       | RPC rate limit exceeded (includes `retryAfterMs`) |
| `NetworkError`       | `NETWORK_ERROR`       | Yes       | Network timeout or connection failure             |
| `RpcError`           | `RPC_ERROR`           | Varies    | Generic RPC failure                               |
| `InvalidInputError`  | `INVALID_INPUT`       | No        | Invalid address, signature, or parameter          |
| `ConfigurationError` | `CONFIGURATION_ERROR` | No        | Missing required configuration                    |
| `NftMetadataError`   | `NFT_METADATA_ERROR`  | Varies    | NFT metadata fetch failed                         |

**Helper Functions:**

- `isTxIndexerError(error: unknown): error is TxIndexerError`
- `isRetryableError(error: unknown): boolean`
- `wrapError(error: unknown, context?: string): TxIndexerError`

### 6. ATA Detection Utilities

| Function             | Signature                                                        | Description                                |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `detectNewATAs`      | `(tx: RawTransaction) => DetectedATA[]`                          | Detect newly created ATAs from transaction |
| `hasNewATAForOwner`  | `(tx: RawTransaction, ownerAddress: string) => boolean`          | Check if tx created new ATA for owner      |
| `getNewATAsForOwner` | `(tx: RawTransaction, ownerAddress: string) => DetectedATA[]`    | Get new ATAs for specific owner            |
| `detectNewATAsBatch` | `(transactions: RawTransaction[]) => Map<string, DetectedATA[]>` | Batch detect grouped by owner              |

---

## Advanced API (from `tx-indexer/advanced`)

### Low-Level Fetchers

- `fetchWalletBalance`, `fetchWalletSignatures`, `fetchWalletTokenAccounts`
- `fetchWalletAndTokenSignatures`, `fetchTransaction`, `fetchTransactionsBatch`

### RPC Client

- `createSolanaClient(rpcUrl: string, wsUrl?: string): SolanaClient`

### Classification Engine

- `classifyTransaction(legs: TxLeg[], tx: RawTransaction, walletAddress?: string): TransactionClassification`
- `transactionToLegs(tx: RawTransaction, walletAddress?: string): TxLeg[]`
- `detectProtocol(programIds: string[]): ProtocolInfo | null`

### Spam Filtering

- `isSpamTransaction(tx: ClassifiedTransaction, config?: SpamFilterConfig): boolean`
- `filterSpamTransactions(txs: ClassifiedTransaction[], config?: SpamFilterConfig, walletAddress?: string): ClassifiedTransaction[]`

### Leg Utilities

- `validateLegsBalance`, `groupLegsByAccount`, `groupLegsByToken`
- `buildAccountId`, `parseAccountId`

### Memo Parsing

- `extractMemo(tx: RawTransaction): string | null`
- `parseSolanaPayMemo(memo: string): SolanaPayMemo | null`
- `isSolanaPayTransaction(tx: RawTransaction): boolean`

### Token Fetcher

- `createTokenFetcher(options?: TokenFetcherOptions): TokenFetcher`
- `getDefaultTokenFetcher(): TokenFetcher`

### Program ID Constants

- `JUPITER_V6_PROGRAM_ID`, `JUPITER_V4_PROGRAM_ID`
- `TOKEN_PROGRAM_ID`, `SYSTEM_PROGRAM_ID`, `SPL_MEMO_PROGRAM_ID`
- `detectFacilitator(programIds: string[]): string | null`

### NFT Metadata

- `fetchNftMetadata(rpcUrl: string, mintAddress: string): Promise<NftMetadata | null>`
- `fetchNftMetadataBatch(rpcUrl: string, mintAddresses: string[]): Promise<Map<string, NftMetadata>>`

---

## Core Types

### ClassifiedTransaction

```typescript
interface ClassifiedTransaction {
  tx: RawTransaction; // Raw on-chain data
  legs: TxLeg[]; // Balance changes as accounting entries
  classification: TransactionClassification; // Human-readable interpretation
}
```

### RawTransaction

```typescript
interface RawTransaction {
  signature: Signature;
  slot: bigint | number;
  blockTime: bigint | number | null;
  fee?: number;
  err: unknown | null;
  programIds: string[];
  protocol: ProtocolInfo | null;
  preTokenBalances?: TokenBalance[];
  postTokenBalances?: TokenBalance[];
  preBalances?: (bigint | number)[];
  postBalances?: (bigint | number)[];
  accountKeys?: string[];
  memo?: string | null;
}
```

### TxLeg

```typescript
interface TxLeg {
  accountId: string; // Format: "external:{walletAddress}:{mint}" or "protocol:{protocolId}"
  side: "debit" | "credit"; // Decrease or increase
  amount: MoneyAmount;
  role: TxLegRole; // "sent" | "received" | "fee" | "reward" | "protocol_deposit" | "protocol_withdraw" | "principal" | "interest" | "unknown"
}
```

### TransactionClassification

```typescript
interface TransactionClassification {
  primaryType: TxPrimaryType;
  primaryAmount: MoneyAmount | null;
  secondaryAmount?: MoneyAmount | null;
  sender?: string | null;
  receiver?: string | null;
  counterparty: Counterparty | null; // Best-effort, display only
  confidence: number; // 0-1
  isRelevant?: boolean;
  metadata?: Record<string, unknown>;
}
```

### MoneyAmount

```typescript
interface MoneyAmount {
  token: TokenInfo;
  amountRaw: string; // Raw amount as string (for precision)
  amountUi: number; // Human-readable amount
  fiat?: FiatValue; // Optional fiat conversion
}
```

### TokenInfo

```typescript
interface TokenInfo {
  mint: string;
  symbol: string;
  name?: string;
  decimals: number;
  logoURI?: string;
}
```

---

## Transaction Types Supported

| Type             | Description                                           | Priority |
| ---------------- | ----------------------------------------------------- | -------- |
| `solana_pay`     | Solana Pay transactions                               | 90       |
| `bridge_in`      | Receiving from bridge (Wormhole, deBridge, Allbridge) | 88       |
| `bridge_out`     | Sending to bridge                                     | 88       |
| `nft_mint`       | NFT minting (Metaplex, Candy Machine, Bubblegum)      | 85       |
| `stake_deposit`  | SOL staking deposits                                  | 80       |
| `stake_withdraw` | SOL staking withdrawals                               | 80       |
| `swap`           | Token exchanges (Jupiter, Raydium, Orca, etc.)        | 70       |
| `airdrop`        | Token distributions (credit-only, no debit)           | 60       |
| `transfer`       | Wallet-to-wallet transfers                            | 50       |
| `fee_only`       | Transactions with only network fees                   | 10       |
| `other`          | Unclassified transactions                             | 0        |

**Additional types defined but not yet implemented:**

- `nft_purchase`, `nft_sale`
- `token_deposit`, `token_withdraw`
- `reward`

---

## Protocols Supported

### DEX Aggregators

- Jupiter (V4, V6, Limit Order)

### AMMs/DEXes

- Raydium (AMM, CLMM, CPMM, Stable)
- Orca (Whirlpool, Token Swap V1)
- Meteora (DLMM, Pools)
- Lifinity V2
- Pump.fun (AMM, Bonding Curve)
- Saber Stable Swap
- Mercurial Stable Swap

### CLOBs (Order Books)

- OpenBook V2
- Phoenix

### NFT Programs

- Metaplex Token Metadata
- Metaplex Candy Machine V3
- Metaplex Candy Guard
- Bubblegum (compressed NFTs)
- Magic Eden Candy Machine

### Staking

- Native Stake Program
- Stake Pool Program

### Bridges

- Wormhole (Core + Token Bridge)
- deBridge
- Allbridge
- DeGods Bridge

### Infrastructure

- Token Program (SPL)
- Token-2022 Program
- System Program
- Compute Budget Program
- Associated Token Program
- Memo Program (V1 + SPL)

---

## Known Limitations

### 1. Transaction Types Not Fully Supported

- **NFT Purchase/Sale**: The SDK can detect NFT mints but purchase/sale classification depends on marketplace-specific patterns not currently implemented
- **Lending/Borrowing**: No dedicated classifiers for lending protocols (Marginfi, Solend, etc.)
- **Liquidity Provision**: LP add/remove operations classified as "other" or "swap"
- **Governance**: Voting transactions not classified

### 2. Protocol Coverage

- **Only Solana mainnet** - No devnet/testnet support
- **New protocols** may not be detected until added to the known programs list
- **Protocol versions** - Only specific program IDs are recognized; new deployments need manual addition

### 3. NFT Metadata Requirements

- **Requires DAS-compatible RPC** (Helius, Triton, etc.) for `getNftMetadata`
- Standard RPCs will fail; use `enrichNftMetadata: false` as workaround
- Compressed NFT metadata requires Bubblegum-aware RPC

### 4. Token Metadata

- **Static registry** covers ~30 popular tokens
- Unknown tokens show truncated mint address as symbol
- No on-chain metadata fetching for unknown tokens (performance tradeoff)

### 5. Classification Accuracy

- **Confidence scores** range from 0-1 but are heuristic-based
- **Counterparty info** is best-effort display data; do NOT use for security decisions
- Complex multi-hop transactions may be partially classified
- Failed transactions still classified based on intent

### 6. Rate Limiting

- Default settings optimized for ~10 req/sec RPCs
- Aggressive pagination may hit rate limits on free tier RPCs
- Use `overfetchMultiplier: 1`, `minPageSize: 10`, `maxTokenAccounts: 3` for constrained environments

### 7. Pagination

- **No random access** - cursor-based only (`before`/`until`)
- Large gaps in transaction history may require many iterations
- `includeTokenAccounts` disabled by default to reduce RPC calls (may miss some incoming transfers)

### 8. Data Freshness

- Transactions must be finalized on-chain before fetching
- No real-time/websocket streaming of new transactions
- `blockTime` may be null for recent transactions

### 9. JSON Serialization

- `bigint` values converted to strings (slot, blockTime, balances)
- `Date` objects converted to ISO strings
- Must use `toJsonClassifiedTransaction` for server-side serialization

### 10. Experimental APIs

- `getSignatures()` and `getTransactionsBySignatures()` marked experimental
- API shape may change in minor versions
- Intended for advanced pagination/caching use cases

---

## API Stability Tiers

| Tier         | Guarantee                                         | Entry Point           |
| ------------ | ------------------------------------------------- | --------------------- |
| **Stable**   | No breaking changes without major version bump    | `tx-indexer`          |
| **Advanced** | May change in minor versions with migration notes | `tx-indexer/advanced` |
| **Internal** | No guarantees                                     | Not exported          |

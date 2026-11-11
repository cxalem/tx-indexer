# tx-indexer SDK Documentation

## Package Information

| Property        | Value                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Name**        | `tx-indexer`                                                                                                                                     |
| **Version**     | `2.0.0` (unreleased)                                                                                                                                          |
| **Description** | A TypeScript SDK that transforms raw Solana transactions into human-readable financial data with automatic classification and protocol detection |
| **License**     | MIT                                                                                                                                              |
| **Author**      | cxalem                                                                                                                                           |
| **Homepage**    | https://itx-indexer.com/                                                                                                                         |
| **Repository**  | https://github.com/cxalem/tx-indexer.git                                                                                                         |

### Dependencies

- **Runtime**: `zod` ^4.6.7
- **Peer Dependencies**: `typescript` ^5 || ^6, `@solana/kit` ^8.0.0 (8.x)
- **Node.js**: >=20.18.0 (`engines.node`; the minimum of `@solana/kit` 8)

### Bundle Size

Measured with size-limit 14 (Rolldown), minified + brotli, **including** the tree-shaken parts of `@solana/kit` and `zod` that each import pulls in:

| Import                                  | Size (minified + brotli) |
| --------------------------------------- | ------------------------ |
| Full SDK (`createIndexer` + errors)     | ~39 KB                   |
| `createIndexer` only                    | ~39 KB                   |
| `classifyTransaction` (advanced)        | ~27 KB                   |
| `fetchTransaction` (advanced)           | ~30 KB                   |
| `transactionToLegs` (advanced)          | ~29 KB                   |

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

- `classifyTransaction(legs: TxLeg[], tx: RawTransaction, walletAddress?: string, options?: { legacyLegs?: TxLeg[] }): TransactionClassification` (also `classifyTransactionWithTrace`)
- `transactionToLegs(tx: RawTransaction, walletAddress?: string): TxLeg[]`
- `transactionToLegInputs(tx: RawTransaction, walletAddress?: string): { "v2-closed-token-accounts": TxLeg[]; "v1-main": TxLeg[] }`

**Versioned leg inputs.** The legs you receive are the truthful ones (`"v2-closed-token-accounts"`: token accounts closed in the transaction included, owner and mint changes split, raw-amount signs, `closedTokenAccount` provenance). Each classifier declares which leg input it was calibrated on and reads that one; a classifier moves to the truthful legs only when it is migrated on evidence. Today **no classifier is migrated**: all eleven (Solana Pay, Privacy Cash, bridge, NFT mint, NFT transfer and marketplace, stake deposit and withdraw, swap, airdrop, fee-only, transfer) read `"v1-main"`, the legs as built at commit 3111fd7 (an internal compatibility input from a frozen copy of that mapper), and their source is identical to 3111fd7 (checked with git and with committed sha256 digests). The list spam filter (`filterSpam` in `getTransactions` / `getTransactionsBySignatures`) also reads `"v1-main"`. The debug trace records the input each classifier read (`decisions[].legInput`).

So classification (kind, amounts, participants, relevance, confidence, metadata, selecting classifier) and list filtering through the SDK methods are identical to 3111fd7; evaluated debug-trace decisions now also carry `legInput`. The repository's oracle test checks every corpus entry (legs, each classifier, final result) with no exception, and an SDK-boundary test checks representative entries through the SDK methods with a serialising cache and token enrichment. What changes for you is the returned legs.

> **Warning: custom pipelines must call `classifyTransaction` with four arguments.** `getTransaction` and friends do this for you. If you call it yourself, build both views with `transactionToLegInputs(tx, wallet)` (same wallet for both; never cache by signature alone) and pass `{ legacyLegs: views["v1-main"] }`. With only three arguments every classifier reads the array you pass, so passing the returned (truthful) legs gives results that differ from the SDK pipeline. Do not build a "legacy" array by filtering legs.
>
> ```typescript
> const views = transactionToLegInputs(tx, wallet);
> const classification = classifyTransaction(views["v2-closed-token-accounts"], tx, wallet, {
>   legacyLegs: views["v1-main"],
> });
> ```
- `detectProtocol(programIds: string[]): ProtocolInfo | null`

### Spam Filtering

- `isSpamTransaction(tx: ClassifiedTransaction, config?: SpamFilterConfig): boolean`
- `filterSpamTransactions(txs: ClassifiedTransaction[], config?: SpamFilterConfig, walletAddress?: string): ClassifiedTransaction[]`
- Leg input: the SDK's list filter (`getTransactions`, `getTransactionsBySignatures`) feeds the dust / wallet-involvement rules the `"v1-main"` legs, like the classifiers, not the returned legs. It rebuilds them from `tx` for the queried wallet on every call (also for transactions returned by `getCached`, whether the original object, a clone or a deserialised copy) and, with token enrichment on, enriches them from their own mints. The standalone `isSpamTransaction` / `filterSpamTransactions` read whatever legs you pass: to get the SDK's decisions, pass `transactionToLegInputs(tx, wallet)["v1-main"]`.

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
  accountKeys?: string[]; // full resolved list: static, then lookup-table writable, then readonly
  loadedAddresses?: { writable: string[]; readonly: string[] }; // lookup-table accounts (v0)
  memo?: string | null;
  reconciliation?: LamportReconciliation; // see Known Limitations: Lamport Reconciliation
  tokenBalanceStatus?: { status: "available" | "unavailable"; reason?: string }; // token snapshots present?
}

interface LamportReconciliation {
  status: "balanced" | "unbalanced" | "unavailable";
  feeLamports: string | null; // meta.fee
  netLamportsOut: string | null; // sum(pre) - sum(post)
  residualLamports: string | null; // netLamportsOut - feeLamports
  accountCount: number;
  reason?: string;
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

**Measured accuracy.** The repository keeps a hand-labelled set of real mainnet transactions in [`accuracy/`](../../accuracy/README.md), replayed offline through `getTransaction` (enrichment off) and scored against labels written from the instructions, not from SDK output. Current baseline (SDK 2.0.0; classification identical to 3111fd7, 43 transactions, 72 wallet perspectives; see [`accuracy/BASELINE.md`](../../accuracy/BASELINE.md)). Numbers marked * are provisional: 7 of the 72 perspectives come from disputed cases, scored on their verified part only.

- Primary action correct for every selected perspective, with fee and execution status right: **6 of 43 transactions (14%)***.
- Primary action fully correct (kind, amounts and participants): **13 of 72 perspectives (18%)***.
- Primary kind right: **42 of 72 perspectives (58%)***. `transfer` kind precision **58%** (22 wrong `transfer` labels on lending, liquidity, burns, account creation and closing, NFT moves, tips and keeper fee payers); `swap` kind precision 100%, recall 71%. Kind precision counts a right label with wrong amounts as right; the line above is the stricter figure.
- Amounts exact in **13 of the 42 perspectives** where the kind is right and the amounts are known (mint, raw amount, decimals, and direction where the classification exposes it). SOL amounts usually include the network fee, tips or rent.
- 11 labels the set marks as wrong outright (for example `transfer` for a lending borrow). Fee and execution status: 43/43.
- The SDK reports one action per transaction: it finds 2 of the 93 expected secondary actions (tips, account creations, closes, fee reimbursements, second swaps). Secondary actions are not part of the pass rule today.

The set is deliberately weighted towards hard cases, so these are not population-wide rates. Run `bun run accuracy` from the repository root.

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

### 10. Transaction Versions (v1 boundary)

- The SDK requests transactions with `maxSupportedTransactionVersion: 1`, so it reads **legacy, v0 and v1** transactions (v1 is live on mainnet since 2026-09-15).
- v1 messages have no address lookup tables: every account is a static key, `meta.loadedAddresses` is empty, and balances, token `accountIndex`, `meta.fee` and lamport reconciliation keep their v0 meaning.
- **Versions above 1** are refused by the RPC (JSON-RPC error `-32015`). They are not retried:
  - `getTransaction` / `getRawTransaction` and the `tx-indexer/advanced` `fetchTransaction` throw `UnsupportedTransactionVersionError` (`code: "UNSUPPORTED_TRANSACTION_VERSION"`, `retryable: false`, carries `signature`).
  - `getTransactions` and `getTransactionsBySignatures` **omit them from the result**. They are reported only if you pass `onTransactionSkipped({ signature, reason: "unsupported_version", error })`; without the callback they are still dropped silently. Signatures the RPC does not return are reported as `"not_found"`, other failures as `"fetch_failed"`.
- v0 address-lookup-table accounts are resolved: `tx.accountKeys` is the full list (static keys, then lookup-table writable, then lookup-table readonly), which is what `preBalances`/`postBalances` and token `accountIndex` refer to.

### 11. Lamport Reconciliation

- The `fee:network` leg is the fee the runtime charged (`meta.fee`), not a computed residual. A hand-built `RawTransaction` without `fee` gets no fee leg.
- Lamport balances from the fetch path are `bigint`.
- A wSOL (native-mint) token account is represented once: by its actual **lamport** delta, attributed to the token owner (or to the account's own address when the balance metadata has no owner); the native token-amount change is not emitted, so a `sync_native` alone produces no leg. The full lamport delta goes to the owner, also when the wSOL account is created in the transaction: in that case the owner's credit includes the account's rent-exempt reserve (from a few thousand to about 2 million lamports, depending on the cluster's rent parameters), because the reserve cannot be told apart from funding using transaction data alone. Only the legacy native mint (`So11111111111111111111111111111111111111112`) is recognised; Token-2022's native mint (`9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP`) is not handled and keeps ordinary lamport and token legs.
- **Closed wSOL accounts (known limitation):** a wSOL account closed in the transaction (pre-only native entry) keeps an ordinary lamport leg on the token account's own address, not on its owner, and gets no token leg.
- **Closed token accounts (non-native):** an account closed in the transaction (pre-only entry) produces a debit of its full pre amount attributed to its pre owner; an owner or mint change on the same account index is reported as two separate movements, never netted. The rent refund of a close stays an ordinary lamport movement. Debit vs credit comes from raw integer amounts. The debit of an account the transaction **closed** carries `leg.closedTokenAccount` (the token account address). It is set only when the account has a pre entry and no post entry and ends the transaction with zero lamports; it is not set for an owner change, a mint change on the same index, or a pre-only entry whose account still holds lamports (or whose post lamport balance is unknown), which keep an ordinary debit.
- **Closed-account debits do not reach classification yet.** Every classifier reads the 3111fd7 legs, where a closed account's debit does not exist. Selling a whole balance and closing the account (PumpSwap, Pump.fun) is therefore still labelled as on 3111fd7 (often `transfer` of the SOL proceeds) until an instruction-backed swap recognizer exists. Balance evidence alone cannot tell a sale from a transfer-and-close or a burn plus an unrelated mint, so no balance rule is used for it.
- **Known limitation, transfer perspective (unchanged from 1.6.x):** `transfer` picks the best pair over the whole transaction, so a wallet can be shown another wallet's transfer in the same transaction (for example a wallet that only receives rent).
- **Known limitation, swap rent refund (unchanged from 1.6.x):** when a swap's SOL credit includes a closed account's rent refund, the refund is counted in the swap's SOL side.
- **Missing token snapshots:** when `meta.preTokenBalances` or `meta.postTokenBalances` is absent, no token balance change is derived and `tx.tokenBalanceStatus.status` is `"unavailable"` (an empty array is a valid, empty snapshot).
- Nonzero transaction-level rewards (historical rent collection) make the reconciliation `unavailable` with an explicit reason.
- Stake withdraw/deposit direction follows the target wallet (fallback: fee payer); a sponsored deposit is attributed to its funder. See CHANGELOG "Unreleased" for migration notes.
- **Sponsored-deposit inference:** when the wallet pays no SOL but receives a non-SOL token on a stake protocol (and has no net SOL credit and sends no other token), the deposit's funder is inferred as the **largest external SOL debit**. The SDK does not verify that the credited mint is the pool's token, nor that the funder's SOL actually reached the pool.
- **Follow-up (not fixed):** with lookup tables resolved, lamport legs of third-party accounts (pool vaults, custody, program-owned accounts) become visible, and the transfer, Solana Pay, bridge, Privacy Cash, NFT mint and NFT marketplace classifiers can pick them as sender, receiver or price, exactly as they already do on earlier versions when those accounts are static keys. Fixing this needs payment-specific evidence (instruction or program context), not wallet membership.
- `tx.reconciliation` reports whether `sum(preBalances) - sum(postBalances)` equals the fee over the full account list: `balanced`, `unbalanced` (with `residualLamports`) or `unavailable` (metadata missing, arrays not matching the account list, imprecise numbers, or nonzero transaction-level rewards). It is computed from raw balances and is **independent** of the legs: `validateLegsBalance` checks the legs separately, and the two can disagree. They measure different things: token supply can change without a counterparty (burns, mints, Token-2022 transfer fees withheld in the destination account), so token legs need not balance per mint while lamports still reconcile. In particular, a burn followed by closing the account now produces a debit of the burned amount with no matching credit, so `validateLegsBalance` reports that mint as unbalanced (supply destroyed, no counterparty); this is expected.

### 12. Experimental APIs

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

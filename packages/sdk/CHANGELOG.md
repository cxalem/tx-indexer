# Changelog

## 2.0.0 (unreleased)

Not published yet. Breaking for SDK consumers: see the first section.

### Breaking: `@solana/kit` peer dependency is now `^8.0.0`

- The `@solana/kit` peer range moved from `^5.0.0` to `^8.0.0` (developed and tested against 8.6.0). Projects on kit 5, 6 or 7 must upgrade kit to install this release without a peer-dependency conflict. The SDK's own use of kit (`createSolanaRpc`, `address`, `signature`, RPC types) did not change shape, so no SDK call sites change.
- The `typescript` peer range is widened to `^5 || ^6`.
- `engines.node` is now declared as `>=20.18.0`, the minimum Node.js version of `@solana/kit` 8.

### Added: version 1 transactions are read

- Transactions are requested with `maxSupportedTransactionVersion: 1`, so v1 transactions (live on mainnet since 2026-09-15) are fetched and classified instead of throwing `UnsupportedTransactionVersionError` / being skipped as `unsupported_version`. v1 messages have no lookup tables, so `tx.accountKeys` is the static key list and `tx.loadedAddresses` is empty; fee leg and reconciliation work as for v0.
- `UnsupportedTransactionVersionError` now means a version **above 1**; its `maxSupportedTransactionVersion` is `1`.

## 1.6.0

Released 2026-11-10. Everything merged since 1.5.0 (2026-02-01). No change to `TxPrimaryType`; existing code keeps working. `tx-indexer/advanced` users should read the migration notes below.

### Added

- Add stable Helius Wallet API funding-source support:
  - New `getWalletFundingSource(walletAddress, options?)` method on `TxIndexer`
  - New stable `WalletFundingSource` and `GetWalletFundingSourceOptions` types
  - New advanced low-level helper: `fetchWalletFundingSource(...)`
  - In-memory caching + in-flight request deduping for repeated lookups

### Changed

- Improved SDK docs around null-vs-throw behavior and wallet funding semantics

### Fixed: classification (merged between February and April 2026, not listed before)

- **Swaps are no longer detected on internal rebalances.** Legs are netted per mint first: the same token leaving and returning to the same owner, plus a small SOL fee, is not a swap. A tiny SOL-only outflow outside a known DEX is treated as a fee.
- **Swap direction follows the wallet you query**, not always the fee payer, so sponsored and relayed swaps read correctly. `getTransaction(signature, { walletAddress })` accepts the perspective wallet.
- **Transfer and Solana Pay pairing** score sender/receiver pairs (exact amount match first, tiny SOL legs penalised) instead of taking the first credit of the same mint.
- **Bridge direction** compares total in and out and returns no match when they are equal, instead of always reporting `bridge_in`.
- **Airdrops** report the largest received token and prefer a protocol account as sender.
- **NFT marketplace:** removed a rule that labelled any marketplace transaction where the wallet paid and received an NFT as `nft_purchase`.
- **Engine:** priority ties are broken by registration order; a non-relevant match (fee only) is returned instead of `other` when nothing relevant matches; every result carries a `debugTrace` (`classifyTransactionWithTrace`).

### Fixed: v0 lookup-table accounts and lamport accounting (migration notes)

- **Lookup-table accounts are resolved.** `tx.accountKeys` is now the full list (static keys, then lookup-table writable, then readonly); lamport movements on lookup-table accounts are no longer dropped. New optional `tx.loadedAddresses`.
- **Fee leg comes from `meta.fee`.** The `fee:network` leg is the fee the runtime charged, no longer the debit/credit residual. On a hand-built `RawTransaction` with `fee` undefined there is now **no fee leg** (previously the residual was used).
- **New `tx.reconciliation`** (`balanced | unbalanced | unavailable`, lamports as strings) reports whether `sum(pre) - sum(post)` equals the fee. Transactions with nonzero transaction-level rewards (historical rent collection) report `unavailable`.
- **Lamport balances are `bigint`** in `preBalances`/`postBalances` from the fetch path (previously `number`, which lost precision above 2^53). `fee` is `undefined` when the RPC returned no metadata.
- **Typed unsupported-version errors.** Version 1 transactions (RPC error -32015) throw `UnsupportedTransactionVersionError` (`code: "UNSUPPORTED_TRANSACTION_VERSION"`, not retried, carries `signature`) from `getTransaction`, `getRawTransaction` and the `tx-indexer/advanced` fetchers.
- **New `onTransactionSkipped` option** on `getTransactions` and `getTransactionsBySignatures` reports each signature that produced no transaction (`not_found | unsupported_version | fetch_failed`); `fetchTransactionsBatch` gains `onSkipped` (exactly one notification per signature).
- **wSOL is represented once.** A wSOL (native-mint) token account is represented once: by its actual **lamport** delta, attributed to the token owner (or to the account's own address when the balance metadata has no owner); the native token-amount change is not emitted, so a `sync_native` alone produces no leg. The full lamport delta goes to the owner, also when the wSOL account is created in the transaction: in that case the owner's credit includes the account's rent-exempt reserve (from a few thousand to about 2 million lamports, depending on the cluster's rent parameters), because the reserve cannot be told apart from funding using transaction data alone. Only the legacy native mint (`So11111111111111111111111111111111111111112`) is recognised; Token-2022's native mint (`9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP`) is not handled and keeps ordinary lamport and token legs. Accounts closed in the transaction (pre-only token entry) are unchanged.
- **Stake direction follows the wallet.** Stake withdraw requires the target wallet (fallback: fee payer) to receive SOL and not send SOL, so a reserve debit no longer turns a withdrawal into a deposit. Stake deposit uses the wallet's own SOL debit; for a sponsored deposit (wallet receives a non-SOL token, pays no SOL, has no net SOL credit and sends no other token) the amount is the largest external SOL debit and the sender is that funder (the credited mint is not verified to be the pool token).
- **Lamport reconciliation and leg validation are independent checks.** `tx.reconciliation` works from raw balances; `validateLegsBalance` works from legs. They can disagree (for example, legs omit pre-only token balances of closed accounts) and neither is derived from the other.
- **Published bundle:** the ESM build now emits a shared chunk so `tx-indexer` and `tx-indexer/advanced` share one copy of the error classes (`instanceof` and `isTxIndexerError` hold across entry points).

## 1.5.0

### Minor Changes

- Add NFT transfer classification for marketplace and P2P transactions:
  - New transaction types:
    - `nft_purchase` - NFT bought on marketplace
    - `nft_sale` - NFT sold on marketplace
    - `nft_receive` - NFT received via direct transfer
    - `nft_send` - NFT sent via direct transfer

  - NFT marketplace detection for:
    - Magic Eden (v2, MMM)
    - Tensor (swap, marketplace, AMM)
    - Hadeswap
    - Metaplex Auction House
    - Formfunction

  - Smart classification logic:
    - Direct NFT transfers detected by decimals=0 token movements
    - Marketplace buy/sell determined by wallet perspective
    - Escrow pattern handling (falls back to SOL flow analysis)
    - Confidence levels: 0.9 for direct, 0.85 for SOL-flow based

  ```typescript
  const tx = await indexer.getTransaction(signature);

  if (tx.classification.primaryType === "nft_sale") {
    console.log(
      "Sold NFT for",
      tx.classification.secondaryAmount?.amountUi,
      "SOL",
    );
  }

  if (tx.classification.primaryType === "nft_receive") {
    console.log("Received NFT:", tx.classification.metadata?.nft_name);
  }
  ```

## 1.4.0

### Minor Changes

- Add Privacy Cash protocol support:
  - New Privacy Cash protocol detection and classification
  - New transaction types for privacy operations (shield/unshield)
  - Expanded SDK documentation for privacy-related behavior and limitations

## 1.3.2

### Patch Changes

- Accept string or Signature for before/until pagination options:
  - `GetTransactionsOptions.before/until` now accept `SignatureInput` (string | Signature)
  - `GetSignaturesOptions.before/until` now accept `SignatureInput` (string | Signature)
  - Users no longer need `parseSignature()` or type assertions for pagination

  ```typescript
  // Before
  getTransactions(wallet, { before: parseSignature("abc123...") });

  // After (both work)
  getTransactions(wallet, { before: "abc123..." });
  getTransactions(wallet, { before: parseSignature("abc123...") });
  ```

## 1.3.1

### Patch Changes

- Make client type more flexible for custom Solana clients:
  - Replace `SolanaClient` with `IndexerClient` interface (only requires `rpc`)
  - Export `IndexerClient` and `IndexerRpcApi` types for custom integrations
  - Allows integration with `@solana/react-core` and other Solana clients

  Example usage with custom client:

  ```typescript
  import { createIndexer, type IndexerClient } from "tx-indexer";

  const indexer = createIndexer({
    client: { rpc: myCustomRpc } as IndexerClient,
  });
  ```

## 1.3.0

### Minor Changes

- Add devnet and testnet support with cluster-aware token resolution:
  - New `cluster` option in `createIndexer()` to specify network ("mainnet-beta", "devnet", "testnet")
  - New `customTokens` option to provide custom token metadata
  - Added `DEVNET_KNOWN_TOKENS` and `DEVNET_TOKEN_INFO` exports for devnet token addresses
  - Token fetcher automatically uses appropriate registry based on cluster
  - Jupiter API is only called on mainnet; devnet/testnet use static registries
  - Export `Cluster` type for TypeScript users

  Example usage:

  ```typescript
  import { createIndexer, DEVNET_KNOWN_TOKENS } from "tx-indexer";

  // Devnet indexer
  const indexer = createIndexer({
    rpcUrl: "https://api.devnet.solana.com",
    cluster: "devnet",
  });

  // With custom tokens
  const indexer = createIndexer({
    rpcUrl: "https://api.devnet.solana.com",
    cluster: "devnet",
    customTokens: {
      "MyMintAddress...": {
        mint: "MyMintAddress...",
        symbol: "TEST",
        name: "Test Token",
        decimals: 9,
      },
    },
  });
  ```

## 1.2.1

### Patch Changes

- Improve cross-platform compatibility:
  - Replace `process.env` with `globalThis.process?.env` for edge runtime compatibility in token-fetcher
  - Replace Node.js Buffer with Uint8Array/atob for browser compatibility in memo-parser
  - Code formatting improvements (tabs, quote style consistency)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-09

### Added

- **RPC Request Profiler**: Test utility to measure HTTP requests during SDK operations
  - Run with: `RPC_URL=<url> PROFILE_WALLET=<addr> bun test rpc-profiler`

- **RPC Optimization Options**: New options for rate-limited RPC environments
  - `overfetchMultiplier` - Controls signature overfetch (default: 2, use 1 for strict rate limits)
  - `minPageSize` - Minimum page size for fetching (default: 20)
  - `maxTokenAccounts` - Limit ATA queries (default: 5)

### Changed

- **Token Account Fetching**: Optimized signature retrieval
  - Sequential wallet → ATA fetching to avoid rate limit errors
  - Only fetch ATAs when wallet signatures aren't sufficient
  - Parallel fetching of wallet and token account signatures where safe

- **Performance Improvements**: Significantly reduced RPC calls for rate-limited environments
  - Load time improvements from ~105s to ~7s in constrained environments
  - Disabled JSON-RPC batching (not supported on most free tier RPCs)

### Fixed

- Rate limit handling for Helius free tier (10 req/sec) and similar constrained RPCs

## [1.0.0] - 2025-01-09

### Added

- **API Stability Tiers**: Introduced `tx-indexer/advanced` subpath for power users
  - Low-level fetchers (`fetchTransaction`, `fetchWalletSignatures`, etc.)
  - Classification engine (`classifyTransaction`, `detectProtocol`)
  - Spam filtering, leg validation, and other utilities
  - See [STABILITY.md](./STABILITY.md) for tier definitions

- **String Input Support**: Methods now accept plain strings in addition to branded types
  - `getBalance("wallet...")` works without `parseAddress()`
  - `getTransaction("sig...")` works without `parseSignature()`
  - Branded types still supported for type-safe usage

- **Custom Error Hierarchy**: Typed errors for better error handling
  - `RateLimitError` - RPC rate limits with `retryAfterMs`
  - `NetworkError` - Network timeouts and connection failures
  - `RpcError` - Generic RPC failures
  - `InvalidInputError` - Invalid addresses, signatures, or parameters
  - `ConfigurationError` - Missing required configuration
  - `NftMetadataError` - NFT metadata fetch failures
  - `isRetryableError()` helper for retry logic

- **Documentation**: Comprehensive README updates
  - Pagination semantics (`before`/`until` cursors)
  - Error handling patterns
  - Null vs throw behavior
  - API reference for all methods

### Changed

- **Export Reorganization**: Low-level APIs moved to `tx-indexer/advanced`
  - Main export (`tx-indexer`) now contains only stable, user-facing APIs
  - Advanced export for power users needing fine-grained control
  - Breaking: Direct imports of low-level functions must update paths

- **Removed `./client` subpath**: Use main export instead
  - `import { createIndexer } from "tx-indexer"` (no change)
  - `import { createIndexer } from "tx-indexer/client"` (removed)

## [0.6.0] - 2025-01-XX

### Added

- NFT metadata enrichment with DAS RPC support
- Token metadata enrichment from on-chain data
- Spam transaction filtering with configurable rules
- Incremental transaction fetching with `until` parameter

### Changed

- `includeTokenAccounts` now defaults to `false` (reduces RPC calls)
- Reduced default concurrency settings for rate limit compliance

### Fixed

- Rate limit detection for Solana SDK error code 8100002
- Retry logic for 502, 503, 504 status codes

## [0.5.0] - 2025-01-XX

### Added

- JSON-safe serialization helpers (`toJsonClassifiedTransaction`)
- `JsonClassifiedTransaction` and related types for server-side usage
- Protocol detection for Jupiter, Raydium, Orca, and more

### Changed

- `primaryAmount` and `secondaryAmount` now typed as `MoneyAmount | null`

## [0.4.0] - 2024-12-XX

### Added

- Transaction leg mapping with double-entry accounting
- Classification confidence scores
- Counterparty detection for known protocols

## [0.3.0] - 2024-12-XX

### Added

- Basic transaction classification (transfer, swap, etc.)
- Wallet balance fetching
- Token account discovery

## [0.2.0] - 2024-12-XX

### Added

- Transaction fetching with retry logic
- Signature pagination

## [0.1.0] - 2024-12-XX

### Added

- Initial release
- `createIndexer()` factory function
- Basic RPC client wrapper

---

## Versioning Policy

This project follows [Semantic Versioning](https://semver.org/):

- **Major version (X.0.0)**: Breaking changes to stable APIs
- **Minor version (0.X.0)**: New features, non-breaking changes, advanced API changes
- **Patch version (0.0.X)**: Bug fixes

For pre-1.0 releases, minor versions may include breaking changes with migration notes.

## Deprecation Policy

- Deprecated APIs are marked with `@deprecated` JSDoc tags
- Deprecated APIs remain functional for at least one minor version
- Migration notes are provided in the changelog
- Removed APIs are listed in the "Breaking Changes" section

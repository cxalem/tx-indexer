# Changelog

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

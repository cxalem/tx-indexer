# API Stability Tiers

This document describes the stability guarantees for different parts of the tx-indexer SDK.

## Tier Definitions

### Stable (`tx-indexer`)

**Guarantee:** No breaking changes without a major version bump.

APIs in this tier are production-ready and follow semantic versioning strictly:

- Bug fixes in patch versions (1.0.x)
- New features in minor versions (1.x.0)
- Breaking changes only in major versions (x.0.0)

**What's included:**

- `createIndexer()` and `TxIndexer` interface
- `getBalance()`, `getTransactions()`, `getTransaction()`, `getRawTransaction()`
- `getNftMetadata()`, `getNftMetadataBatch()`
- `getWalletFundingSource()`
- `parseAddress()`, `parseSignature()`
- All core types (`ClassifiedTransaction`, `RawTransaction`, `TxLeg`, etc.)
- JSON serialization helpers (`toJsonClassifiedTransaction`, etc.)
- Token registry (`getTokenInfo`, `KNOWN_TOKENS`, etc.)
- RPC optimization options (`overfetchMultiplier`, `minPageSize`, `maxTokenAccounts`)

### Advanced (`tx-indexer/advanced`)

**Guarantee:** Stable within minor versions, may change in minor versions with migration notes.

APIs in this tier are for power users who need fine-grained control. They're stable but:

- May have signature changes in minor versions
- Will always include migration notes in CHANGELOG
- Will never be removed without deprecation warning

**What's included:**

- Low-level fetchers (`fetchTransaction`, `fetchWalletSignatures`, etc.)
- RPC client creation (`createSolanaClient`)
- Classification engine (`classifyTransaction`, `detectProtocol`)
- Transaction leg mapping (`transactionToLegs`)
- Spam filtering (`filterSpamTransactions`, `isSpamTransaction`)
- Leg validation utilities (`validateLegsBalance`, `groupLegsByAccount`)
- Account ID utilities (`buildAccountId`, `parseAccountId`)
- Memo parsing (`extractMemo`, `parseSolanaPayMemo`)
- Token fetcher (`createTokenFetcher`)
- Program ID constants
- Helius Wallet API low-level fetcher (`fetchWalletFundingSource`)

### Internal (not exported)

**Guarantee:** None. May change at any time.

Internal implementation details that are not exported from any entry point.
Do not import from internal paths like `tx-indexer/dist/...`.

## Import Patterns

```typescript
// Stable API - recommended for most users
import { createIndexer, parseAddress } from "tx-indexer";

// Advanced API - for power users
import { fetchTransaction, classifyTransaction } from "tx-indexer/advanced";

// Types only - for type declarations
import type { ClassifiedTransaction, TxLeg } from "tx-indexer/types";
```

## Deprecation Policy

When we deprecate an API:

1. **Deprecation warning** added via JSDoc `@deprecated` tag
2. **Migration notes** in CHANGELOG explaining the replacement
3. **Minimum 1 minor version** before removal (advanced tier)
4. **Minimum 1 major version** before removal (stable tier)

## Version History

| Version | Tier Changes                                  |
| ------- | --------------------------------------------- |
| 1.1.0   | Added RPC optimization options to stable tier |
| 1.0.0   | Initial stable release with tier system       |
| 0.x.x   | Pre-release, no stability guarantees          |

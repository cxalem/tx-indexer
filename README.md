# TX Indexer

A Solana transaction indexer and classification SDK that transforms raw blockchain transactions into categorized, user-friendly financial data.

## Overview

TX Indexer is a TypeScript SDK for fetching, classifying, and understanding Solana transactions. It provides a high-level API that automatically categorizes transactions (swaps, transfers, NFT mints, staking, bridges, etc.) and detects the protocols involved.

The SDK transforms raw blockchain data through a three-layer architecture:

```
RawTransaction → TxLeg[] → TransactionClassification
```

**Key capabilities:**

- Fetch wallet balances and transaction history
- Automatic transaction classification with confidence scoring
- Protocol detection (Jupiter, Raydium, Metaplex, Wormhole, etc.)
- Pure on-chain classification (no wallet context required)
- Double-entry accounting validation
- Spam filtering
- Type-safe with comprehensive JSDoc documentation

## Installation

```bash
bun add tx-indexer
# or
npm install tx-indexer
```

## Quick Start

```typescript
import { createIndexer } from "tx-indexer";

const indexer = createIndexer({
  rpcUrl: "https://api.mainnet-beta.solana.com",
});

// Get wallet balance - accepts plain strings
const balance = await indexer.getBalance("YourWalletAddress...");
console.log(`SOL: ${balance.sol.ui}`);

// Get classified transactions
const transactions = await indexer.getTransactions("YourWalletAddress...", {
  limit: 10,
  filterSpam: true,
});

for (const { tx, classification } of transactions) {
  console.log(
    `${classification.primaryType}: ${classification.primaryAmount?.amountUi} ${classification.primaryAmount?.token.symbol}`,
  );
}

// Get a single transaction
const tx = await indexer.getTransaction("5k9XPH7FKz...");
if (tx) {
  console.log(`Type: ${tx.classification.primaryType}`);
  console.log(`From: ${tx.classification.sender}`);
  console.log(`To: ${tx.classification.receiver}`);
}
```

## Entry Points

The SDK provides multiple entry points for different use cases:

```typescript
// Main API - stable, recommended for most users
import {
  createIndexer,
  parseAddress,
  parseSignature,
  RateLimitError,
  isRetryableError,
  toJsonClassifiedTransaction,
} from "tx-indexer";

// Advanced API - for power users needing low-level control
import {
  fetchTransaction,
  fetchWalletSignatures,
  classifyTransaction,
  transactionToLegs,
  detectProtocol,
  filterSpamTransactions,
} from "tx-indexer/advanced";

// Types only - for type declarations
import type {
  ClassifiedTransaction,
  TxLeg,
  RawTransaction,
} from "tx-indexer/types";
```

See the [SDK documentation](./packages/sdk/README.md) for complete API reference.

## Error Handling

The SDK provides typed errors for different failure scenarios:

```typescript
import {
  RateLimitError,
  NetworkError,
  InvalidInputError,
  isRetryableError,
} from "tx-indexer";

try {
  const txs = await indexer.getTransactions(wallet);
} catch (error) {
  if (error instanceof RateLimitError) {
    await sleep(error.retryAfterMs);
    return retry();
  }

  if (isRetryableError(error)) {
    return retry();
  }

  throw error;
}
```

| Error                | Code                  | Retryable | Description                           |
| -------------------- | --------------------- | --------- | ------------------------------------- |
| `RateLimitError`     | `RATE_LIMIT`          | Yes       | RPC rate limit exceeded               |
| `NetworkError`       | `NETWORK_ERROR`       | Yes       | Network timeout or connection failure |
| `RpcError`           | `RPC_ERROR`           | Varies    | Generic RPC failure                   |
| `InvalidInputError`  | `INVALID_INPUT`       | No        | Invalid address or signature          |
| `ConfigurationError` | `CONFIGURATION_ERROR` | No        | Missing required configuration        |

## Pagination

Cursor-based pagination with `before` and `until`:

```typescript
// First page
const page1 = await indexer.getTransactions(wallet, { limit: 10 });

// Next page
const lastSig = page1[page1.length - 1].tx.signature;
const page2 = await indexer.getTransactions(wallet, {
  limit: 10,
  before: lastSig,
});

// Fetch only new transactions since last known
const newTxs = await indexer.getTransactions(wallet, {
  limit: 50,
  until: lastKnownSignature,
});
```

## JSON Serialization

For server-side usage (Next.js API routes, server actions):

```typescript
import {
  toJsonClassifiedTransaction,
  type JsonClassifiedTransaction,
} from "tx-indexer";

// Next.js server action
("use server");
export async function getWalletTxs(
  wallet: string,
): Promise<JsonClassifiedTransaction[]> {
  const indexer = createIndexer({ rpcUrl: process.env.RPC_URL! });
  const txs = await indexer.getTransactions(wallet);
  return toJsonClassifiedTransactions(txs); // Handles bigint → string
}
```

## Architecture

This is a monorepo with the SDK built from multiple internal packages:

```
tx-indexer/
├── packages/
│   ├── sdk/              # Main SDK entry point (tx-indexer on npm)
│   ├── core/             # Core types, money handling, token registry
│   ├── solana/           # RPC client, transaction fetching, retry logic
│   └── classification/   # Classifier system, protocol detection
└── apps/
    └── dashboard/        # Demo Next.js dashboard
```

## Transaction Schema

A `ClassifiedTransaction` has three parts:

```typescript
interface ClassifiedTransaction {
  tx: RawTransaction; // Raw on-chain data
  legs: TxLeg[]; // Double-entry accounting
  classification: TransactionClassification; // Human-readable interpretation
}
```

### Transaction Types

| Type             | Description                                    |
| ---------------- | ---------------------------------------------- |
| `transfer`       | Wallet-to-wallet transfers                     |
| `swap`           | Token exchanges (Jupiter, Raydium, Orca, etc.) |
| `nft_mint`       | NFT minting                                    |
| `nft_purchase`   | NFT purchase                                   |
| `nft_sale`       | NFT sale                                       |
| `stake_deposit`  | SOL staking deposits                           |
| `stake_withdraw` | SOL staking withdrawals                        |
| `bridge_in`      | Receiving from bridge                          |
| `bridge_out`     | Sending to bridge                              |
| `airdrop`        | Token distributions                            |
| `fee_only`       | Transactions with only network fees            |
| `other`          | Unclassified                                   |

## Supported Protocols

- **DEX:** Jupiter, Raydium, Orca Whirlpool
- **NFT:** Metaplex, Candy Machine V3, Bubblegum (compressed NFTs)
- **Staking:** Native Stake Program, Stake Pool Program
- **Bridges:** Wormhole, deBridge, Allbridge
- **Payments:** Solana Pay (SPL Memo)

## RPC Compatibility

The SDK works with any Solana RPC for core features. NFT metadata enrichment requires a DAS-compatible RPC (Helius, Triton, etc.):

```typescript
// Disable NFT enrichment for standard RPCs
const txs = await indexer.getTransactions(address, {
  enrichNftMetadata: false,
});
```

## RPC Optimization

For rate-limited RPCs (like Helius free tier at 10 req/sec), use optimization options:

```typescript
const indexer = createIndexer({
  rpcUrl: "https://api.mainnet-beta.solana.com",
  // Optimization options for rate-limited environments
  overfetchMultiplier: 1, // Default: 2, reduces signature overfetch
  minPageSize: 10, // Default: 20, matches page size to your limit
  maxTokenAccounts: 3, // Default: 5, limits ATA queries
});
```

These optimizations reduce RPC calls significantly (from ~105s to ~7s load time in constrained environments).

## Bundle Size

| Import                          | Size (minified + brotli) |
| ------------------------------- | ------------------------ |
| Main SDK                        | ~12.7 KB                 |
| `createIndexer` only            | ~12.6 KB                 |
| Advanced: `classifyTransaction` | ~6.5 KB                  |
| Advanced: `fetchTransaction`    | ~7.6 KB                  |

## Development

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Type check
bun run typecheck

# Run SDK tests
cd packages/sdk && bun test
```

## Documentation

- [SDK README](./packages/sdk/README.md) - Full API reference
- [CHANGELOG](./packages/sdk/CHANGELOG.md) - Version history
- [STABILITY](./packages/sdk/STABILITY.md) - API stability tiers

## License

MIT

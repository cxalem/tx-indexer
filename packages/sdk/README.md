# tx-indexer SDK

Solana transaction indexer and classification SDK.

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

// Get wallet balance
const balance = await indexer.getBalance("YourWalletAddress...");

// Get classified transactions
const txs = await indexer.getTransactions("YourWalletAddress...", {
  limit: 10,
  filterSpam: true,
});

// Get single transaction
const tx = await indexer.getTransaction("5abc123...");

if (tx) {
  console.log(tx.classification.primaryType); // "transfer", "swap", "nft_mint", etc.
  console.log(tx.classification.sender); // sender address
  console.log(tx.classification.receiver); // receiver address
}
```

## API Reference

### `createIndexer(options)`

Creates an indexer instance.

```typescript
// With RPC URL
const indexer = createIndexer({ rpcUrl: "https://..." });

// With custom Solana client (advanced)
import { createSolanaClient } from "tx-indexer/advanced";
const client = createSolanaClient("https://...");
const indexer = createIndexer({ client });
```

### `indexer.getBalance(walletAddress, tokenMints?)`

Get SOL and token balances for a wallet.

```typescript
const balance = await indexer.getBalance("YourWalletAddress...");

console.log(balance.sol.ui); // SOL balance (human-readable)
console.log(balance.tokens); // Array of token balances
```

### `indexer.getTransactions(walletAddress, options?)`

Get classified transactions for a wallet.

**Options:**

| Option                | Type      | Default | Description                                                  |
| --------------------- | --------- | ------- | ------------------------------------------------------------ |
| `limit`               | `number`  | `10`    | Maximum transactions to return                               |
| `before`              | `string`  | -       | Fetch transactions before this signature (pagination cursor) |
| `until`               | `string`  | -       | Stop when reaching this signature                            |
| `filterSpam`          | `boolean` | `true`  | Filter out spam transactions                                 |
| `enrichNftMetadata`   | `boolean` | `true`  | Fetch NFT metadata (requires DAS RPC)                        |
| `enrichTokenMetadata` | `boolean` | `true`  | Fetch token metadata                                         |

**Returns:** `null` if transaction not found, otherwise `ClassifiedTransaction`.

### `indexer.getTransaction(signature, options?)`

Get a single classified transaction.

```typescript
const tx = await indexer.getTransaction("5abc123...");

if (tx) {
  // Transaction found
}
```

**Returns:** `null` if transaction not found, otherwise `ClassifiedTransaction`.

### `indexer.getRawTransaction(signature)`

Get raw transaction data without classification.

**Returns:** `null` if transaction not found, otherwise `RawTransaction`.

### `indexer.getNftMetadata(mintAddress)`

Get NFT metadata using DAS RPC.

**Returns:** `null` if NFT not found, otherwise `NftMetadata`.

**Throws:** `Error` if `rpcUrl` was not provided (using `client` option).

## Pagination

The SDK uses cursor-based pagination with `before` and `until` parameters:

```typescript
// First page
const page1 = await indexer.getTransactions(wallet, { limit: 10 });

// Next page - use last signature as cursor
const lastSig = page1[page1.length - 1].tx.signature;
const page2 = await indexer.getTransactions(wallet, {
  limit: 10,
  before: lastSig,
});

// Fetch only new transactions since a known point
const newTxs = await indexer.getTransactions(wallet, {
  limit: 50,
  until: lastKnownSignature,
});
```

**Semantics:**

- `before`: Fetch transactions **older** than this signature
- `until`: Stop fetching when this signature is reached (boundary)
- Results are always sorted by block time, newest first

## RPC Compatibility

The SDK works with any Solana RPC for core features (transactions, balances, classification).

NFT metadata enrichment requires a DAS-compatible RPC (Helius, Triton, etc.). If using a standard RPC:

```typescript
const txs = await indexer.getTransactions(address, {
  enrichNftMetadata: false,
});
```

## RPC Optimization

For rate-limited RPCs (like Helius free tier at 10 req/sec), the SDK provides optimization options to reduce RPC calls:

```typescript
const indexer = createIndexer({
  rpcUrl: "https://api.mainnet-beta.solana.com",
  // Optimization options for rate-limited environments
  overfetchMultiplier: 1, // Default: 2, reduces signature overfetch
  minPageSize: 10, // Default: 20, matches page size to your limit
  maxTokenAccounts: 3, // Default: 5, limits ATA queries
});
```

**Options:**

| Option                | Default | Description                                      |
| --------------------- | ------- | ------------------------------------------------ |
| `overfetchMultiplier` | `2`     | Multiplier for signature overfetch (1 = minimal) |
| `minPageSize`         | `20`    | Minimum page size for RPC calls                  |
| `maxTokenAccounts`    | `5`     | Maximum token accounts to query for signatures   |

These optimizations can reduce load time from ~105s to ~7s in rate-limited environments.

## Transaction Schema

A `ClassifiedTransaction` has three parts:

```typescript
interface ClassifiedTransaction {
  tx: RawTransaction; // The raw on-chain data
  legs: TxLeg[]; // Balance changes as accounting entries
  classification: TransactionClassification; // Human-readable interpretation
}
```

**Why this structure?**

1. **`tx` (RawTransaction)** - The immutable on-chain data: signature, slot, balances, program IDs.

2. **`legs` (TxLeg[])** - Double-entry accounting view. Each leg represents a balance change with:
   - `accountId` - Who's balance changed (wallet + token mint)
   - `side` - `"debit"` (decrease) or `"credit"` (increase)
   - `amount` - The `MoneyAmount` with token info and value
   - `role` - Semantic meaning: `"sent"`, `"received"`, `"fee"`, `"protocol_deposit"`, etc.

3. **`classification`** - High-level interpretation for display:
   - `primaryType` - What happened: `"transfer"`, `"swap"`, `"nft_mint"`, etc.
   - `primaryAmount` / `secondaryAmount` - The main values involved
   - `sender` / `receiver` - The human-relevant parties
   - `counterparty` - Known protocol or merchant (best-effort)
   - `confidence` - Classification confidence (0-1)

## Transaction Types

| Type             | Description                                      |
| ---------------- | ------------------------------------------------ |
| `transfer`       | Wallet-to-wallet transfers                       |
| `swap`           | Token exchanges (Jupiter, Raydium, Orca, etc.)   |
| `nft_mint`       | NFT minting (Metaplex, Candy Machine, Bubblegum) |
| `nft_purchase`   | NFT purchase                                     |
| `nft_sale`       | NFT sale                                         |
| `stake_deposit`  | SOL staking deposits                             |
| `stake_withdraw` | SOL staking withdrawals                          |
| `bridge_in`      | Receiving from bridge (Wormhole, deBridge)       |
| `bridge_out`     | Sending to bridge                                |
| `airdrop`        | Token distributions                              |
| `fee_only`       | Transactions with only network fees              |
| `other`          | Unclassified transactions                        |

## Entry Points

The SDK provides multiple entry points for different use cases:

```typescript
// Main API - stable, recommended for most users
import { createIndexer, parseAddress } from "tx-indexer";

// Advanced API - for power users needing low-level control
import {
  fetchTransaction,
  classifyTransaction,
  transactionToLegs,
} from "tx-indexer/advanced";

// Types only - for type declarations
import type { ClassifiedTransaction, TxLeg } from "tx-indexer/types";
```

See [STABILITY.md](./STABILITY.md) for API stability guarantees.

## Error Handling

The SDK provides typed errors for different failure scenarios:

```typescript
import {
  createIndexer,
  RateLimitError,
  NetworkError,
  InvalidInputError,
  ConfigurationError,
  isRetryableError,
} from "tx-indexer";

try {
  const txs = await indexer.getTransactions(wallet);
} catch (error) {
  if (error instanceof RateLimitError) {
    // Wait and retry
    await sleep(error.retryAfterMs);
    return retry();
  }

  if (error instanceof NetworkError) {
    // Network issue - retry with backoff
    console.log("Network error:", error.message);
  }

  if (error instanceof InvalidInputError) {
    // Bad input - don't retry
    console.log(`Invalid ${error.field}: ${error.message}`);
  }

  if (error instanceof ConfigurationError) {
    // Missing configuration
    console.log("Config error:", error.message);
  }

  // Generic check for any retryable error
  if (isRetryableError(error)) {
    return retry();
  }
}
```

### Error Types

| Error                | Code                  | Retryable | Description                              |
| -------------------- | --------------------- | --------- | ---------------------------------------- |
| `TxIndexerError`     | varies                | varies    | Base class for all SDK errors            |
| `RateLimitError`     | `RATE_LIMIT`          | Yes       | RPC rate limit exceeded                  |
| `NetworkError`       | `NETWORK_ERROR`       | Yes       | Network timeout or connection failure    |
| `RpcError`           | `RPC_ERROR`           | Varies    | Generic RPC failure                      |
| `InvalidInputError`  | `INVALID_INPUT`       | No        | Invalid address, signature, or parameter |
| `ConfigurationError` | `CONFIGURATION_ERROR` | No        | Missing required configuration           |
| `NftMetadataError`   | `NFT_METADATA_ERROR`  | Varies    | NFT metadata fetch failed                |

### Null vs Throw

Methods return `null` for "not found" cases and throw for actual errors:

| Method                   | Returns `null`        | Throws                       |
| ------------------------ | --------------------- | ---------------------------- |
| `getTransaction(sig)`    | Transaction not found | Invalid signature, RPC error |
| `getRawTransaction(sig)` | Transaction not found | Invalid signature, RPC error |
| `getNftMetadata(mint)`   | NFT not found         | RPC error, missing config    |
| `getBalance(addr)`       | Never                 | Invalid address, RPC error   |
| `getTransactions(addr)`  | Never (empty array)   | Invalid address, RPC error   |

## JSON-Safe Serialization

For server-side usage (Next.js API routes, server actions), use JSON-safe helpers:

```typescript
import {
  createIndexer,
  toJsonClassifiedTransaction,
  toJsonClassifiedTransactions,
  type JsonClassifiedTransaction,
} from "tx-indexer";

// Next.js API route
export async function GET() {
  const indexer = createIndexer({ rpcUrl: process.env.RPC_URL! });
  const tx = await indexer.getTransaction(signature);

  if (!tx) return new Response("Not found", { status: 404 });

  // Handles bigint → string, Date → ISO string
  return Response.json(toJsonClassifiedTransaction(tx));
}

// Next.js server action
("use server");
export async function getWalletTxs(
  wallet: string,
): Promise<JsonClassifiedTransaction[]> {
  const indexer = createIndexer({ rpcUrl: process.env.RPC_URL! });
  const txs = await indexer.getTransactions(wallet);
  return toJsonClassifiedTransactions(txs);
}
```

## Frontend Integration

Classification is wallet-agnostic. Determine perspective in your frontend:

```typescript
const tx = await indexer.getTransaction(signature);
const connectedWallet = wallet?.address;

if (connectedWallet === tx?.classification.sender) {
  // "You sent..."
} else if (connectedWallet === tx?.classification.receiver) {
  // "You received..."
} else {
  // "Address X sent to Address Y"
}
```

## Counterparty Information

The `classification.counterparty` field provides best-effort display info:

```typescript
if (tx.classification.counterparty) {
  console.log(tx.classification.counterparty.name); // e.g., "Jupiter"
  console.log(tx.classification.counterparty.type); // "protocol", "exchange", etc.
}
```

> **Note:** Counterparty information is for display purposes only. It may not always be accurate and should not be used for security-critical decisions.

## Bundle Size

The SDK is lightweight and tree-shakeable:

| Import                | Size (minified + brotli) |
| --------------------- | ------------------------ |
| Full SDK              | ~11 KB                   |
| `createIndexer` only  | ~11 KB                   |
| `classifyTransaction` | ~6 KB                    |

```bash
bun run size      # Check sizes
bun run size:why  # Analyze bundle
```

## License

MIT

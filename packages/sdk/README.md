# tx-indexer SDK

Solana transaction indexer and classification SDK.

## Installation

```bash
bun add tx-indexer @solana/kit
# or
npm install tx-indexer @solana/kit
```

Requirements: `@solana/kit` 8.x (peer dependency, `^8.0.0`) and Node.js 20.18 or newer (`engines.node: >=20.18.0`, the minimum of `@solana/kit` 8).

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

**Returns:** Array of `ClassifiedTransaction`.

### `indexer.getTransaction(signature, options?)`

Get a single classified transaction.

```typescript
const tx = await indexer.getTransaction("5abc123...");

if (tx) {
  // Transaction found
}
```

**Returns:** `null` if transaction not found, otherwise `ClassifiedTransaction`.

**Options:**

| Option                | Type      | Default | Description                                                             |
| --------------------- | --------- | ------- | ----------------------------------------------------------------------- |
| `enrichNftMetadata`   | `boolean` | `true`  | Fetch NFT metadata (requires DAS RPC)                                   |
| `enrichTokenMetadata` | `boolean` | `true`  | Fetch token metadata                                                    |
| `walletAddress`       | `string`  | -       | Wallet perspective for direction-sensitive classification and leg roles |

### `indexer.getRawTransaction(signature)`

Get raw transaction data without classification.

**Returns:** `null` if transaction not found, otherwise `RawTransaction`.

### `indexer.getNftMetadata(mintAddress)`

Get NFT metadata using DAS RPC.

**Returns:** `null` if NFT not found, otherwise `NftMetadata`.

**Throws:** `Error` if `rpcUrl` was not provided (using `client` option).

### `indexer.getWalletFundingSource(walletAddress, options?)`

Get the first SOL funding source for a wallet using Helius Wallet API.

```typescript
const indexer = createIndexer({
  rpcUrl: "https://api.mainnet-beta.solana.com",
  heliusApiKey: process.env.HELIUS_API_KEY,
});

const funding = await indexer.getWalletFundingSource(
  "86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY",
);

if (funding) {
  console.log(funding.funderName || funding.funder);
  console.log(funding.amount, funding.symbol);
}
```

**Returns:** `null` if no funding transaction exists, otherwise `WalletFundingSource`.

**Notes:**

- Requires Helius API key via `createIndexer({ heliusApiKey })` or per-call override
- Represents the **first incoming SOL transfer** only
- `funder` is the immediate source, not the ultimate source of funds
- Endpoint is beta and attribution fields are best-effort

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

| Type             | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `transfer`       | Wallet-to-wallet transfers                               |
| `swap`           | Token exchanges (Jupiter, Raydium, Orca, etc.)           |
| `nft_mint`       | NFT minting (Metaplex, Candy Machine, Bubblegum)         |
| `nft_purchase`   | NFT bought on marketplace (Magic Eden, Tensor, Hadeswap) |
| `nft_sale`       | NFT sold on marketplace                                  |
| `nft_receive`    | NFT received via direct P2P transfer                     |
| `nft_send`       | NFT sent via direct P2P transfer                         |
| `stake_deposit`  | SOL staking deposits                                     |
| `stake_withdraw` | SOL staking withdrawals                                  |
| `bridge_in`      | Receiving from bridge (Wormhole, deBridge)               |
| `bridge_out`     | Sending to bridge                                        |
| `airdrop`        | Token distributions                                      |
| `fee_only`       | Transactions with only network fees                      |
| `other`          | Unclassified transactions                                |

### NFT Marketplace Support

The SDK detects and classifies NFT transactions from major Solana marketplaces:

- **Magic Eden** - v2 and MMM (Market Making) programs
- **Tensor** - Swap, Marketplace, and AMM programs
- **Hadeswap** - AMM-based NFT trading
- **Metaplex Auction House** - Decentralized auction protocol
- **Formfunction** - Art-focused marketplace

For marketplace transactions, the classifier uses wallet perspective to determine if a transaction is a purchase or sale. When the wallet isn't directly involved in the NFT token movement (common with escrow patterns), it falls back to analyzing SOL/token flow.

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

> **Warning: call `classifyTransaction` with four arguments.** The legs the SDK returns are the truthful ones (closed token accounts included), but every classifier is calibrated on, and reads, the `"v1-main"` legs (as built at 3111fd7). Passing only the returned legs (three arguments) makes every classifier read them, which gives results that can differ from `getTransaction` / `getTransactions`. Build both views and pass the legacy one:
>
> ```typescript
> import { classifyTransaction, transactionToLegInputs } from "tx-indexer/advanced";
>
> const views = transactionToLegInputs(tx, wallet); // same wallet for both views
> const classification = classifyTransaction(views["v2-closed-token-accounts"], tx, wallet, {
>   legacyLegs: views["v1-main"],
> });
> ```

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
| `UnsupportedTransactionVersionError` | `UNSUPPORTED_TRANSACTION_VERSION` | No | Transaction version newer than v1 (see below) |

### Transaction Versions

The SDK reads legacy, v0 and v1 transactions (`maxSupportedTransactionVersion: 1`); v1 transactions have been live on mainnet since 2026-09-15 and need the `@solana/kit` 8.x peer dependency (`^8.0.0`). A transaction with a version above 1 is rejected by the RPC: `getTransaction` throws `UnsupportedTransactionVersionError` (with `signature`), and history methods omit it from the result. To learn which signatures were skipped and why, pass `onTransactionSkipped` (without it they are dropped silently):

```typescript
const txs = await indexer.getTransactions(wallet, {
  onTransactionSkipped: ({ signature, reason }) => {
    // reason: "unsupported_version" | "not_found" | "fetch_failed"
    console.warn(`Skipped ${signature}: ${reason}`);
  },
});
```

Migration notes (see CHANGELOG "Unreleased"): the fee leg now comes from `meta.fee` (no fee leg if a hand-built `RawTransaction` has no `fee`), fetched lamport balances are `bigint`, unsupported-version errors are typed (also from `tx-indexer/advanced`), `onTransactionSkipped` is new, wSOL is represented once (the full lamport delta, attributed to the owner; for a wSOL account created in the transaction that credit includes its rent-exempt reserve; legacy native mint only), and stake direction follows the wallet.

Each fetched transaction carries `tx.reconciliation` (`balanced | unbalanced | unavailable`), a check, computed from raw balances and independent of the legs, that lamports leaving all accounts equal the network fee. See SDK.md "Known Limitations".

### Null vs Throw

Methods return `null` for "not found" cases and throw for actual errors:

| Method                         | Returns `null`          | Throws                                          |
| ------------------------------ | ----------------------- | ----------------------------------------------- |
| `getTransaction(sig)`          | Transaction not found   | Invalid signature, RPC error                    |
| `getRawTransaction(sig)`       | Transaction not found   | Invalid signature, RPC error                    |
| `getNftMetadata(mint)`         | NFT not found           | RPC error, missing config                       |
| `getWalletFundingSource(addr)` | No funding source found | Missing API key, rate limit, network/API errors |
| `getBalance(addr)`             | Never                   | Invalid address, RPC error                      |
| `getTransactions(addr)`        | Never (empty array)     | Invalid address, RPC error                      |

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

Measured with size-limit 14 (Rolldown), minified + brotli, **including** the tree-shaken parts of `@solana/kit` and `zod` that each import pulls in:

| Import                                  | Size (minified + brotli) |
| --------------------------------------- | ------------------------ |
| Full SDK (`createIndexer` + errors)     | ~39 KB                   |
| `createIndexer` only                    | ~39 KB                   |
| `classifyTransaction` (advanced)        | ~27 KB                   |
| `fetchTransaction` (advanced)           | ~30 KB                   |
| `transactionToLegs` (advanced)          | ~29 KB                   |

```bash
bun run size      # Check sizes
bun run size:why  # Analyze bundle (writes rolldown-why-*.html reports and opens them in a browser)
```

## License

MIT

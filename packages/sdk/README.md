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
  rpcUrl: "https://api.mainnet-beta.solana.com" 
});

// Get wallet balance
const balance = await indexer.getBalance("YourWalletAddress...");

// Get classified transactions
const txs = await indexer.getTransactions("YourWalletAddress...", {
  limit: 10,
  filterSpam: true
});

// Get single transaction (no wallet required)
const tx = await indexer.getTransaction("signature...");

// Classification includes sender/receiver
console.log(tx.classification.primaryType); // "transfer", "swap", "nft_mint", etc.
console.log(tx.classification.sender);      // sender address
console.log(tx.classification.receiver);    // receiver address
```

## RPC Compatibility

The SDK works with any Solana RPC for core features (transactions, balances, classification).

NFT metadata enrichment requires a DAS-compatible RPC (Helius, Triton, etc.). If using a standard RPC, disable it:

```typescript
const txs = await indexer.getTransactions(address, {
  enrichNftMetadata: false
});
```

## Transaction Types

- `transfer` - Wallet-to-wallet transfers
- `swap` - Token exchanges (pattern-based detection works with any DEX, higher confidence for known protocols like Jupiter, Raydium, Orca)
- `nft_mint` - NFT minting (Metaplex, Candy Machine, Bubblegum)
- `stake_deposit` - SOL staking deposits
- `stake_withdraw` - SOL staking withdrawals
- `bridge_in` - Receiving from bridge (Wormhole, deBridge, Allbridge)
- `bridge_out` - Sending to bridge
- `airdrop` - Token distributions
- `fee_only` - Transactions with only network fees

## Frontend Integration

Classification is wallet-agnostic. Determine perspective in your frontend:

```typescript
const { classification } = await indexer.getTransaction(signature);
const connectedWallet = wallet?.address;

if (connectedWallet === classification.sender) {
  // "You sent..."
} else if (connectedWallet === classification.receiver) {
  // "You received..."
} else {
  // "Address X sent to Address Y"
}
```

## Bundle Size

The SDK is lightweight and tree-shakeable:

| Import | Size (minified + brotli) |
|--------|----------|
| Full SDK | 11.34 KB |
| `createIndexer` only | 11.34 KB |
| `classifyTransaction` | 6.39 KB |
| `fetchTransaction` | 7.39 KB |
| `transactionToLegs` | 7.3 KB |

Check current sizes:
```bash
bun run size
```

Analyze why a bundle is large:
```bash
bun run size:why
```

## Documentation

See the main [project README](../../README.md) for:
- Complete API reference
- Architecture details
- Exported functions
- Usage examples

## Development

```bash
# Type check
bun run check-types

# Check bundle size
bun run size

# Analyze bundle composition
bun run size:why
```

## License

MIT

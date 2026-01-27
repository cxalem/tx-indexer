# itx

A Solana transaction indexer SDK and wallet dashboard with privacy features.

---

## Dashboard

**[Live Dashboard](https://dashboard.itx-indexer.com)** - Non-custodial Solana wallet with Privacy Hub.

Features: Send/Receive, Trade (Jupiter), Privacy Hub (ZK proofs), Activity Feed, Spam Filtering.

See [`apps/dashboard`](./apps/dashboard) for implementation details and privacy flow.

---

## SDK

TypeScript SDK for fetching and classifying Solana transactions.

### Installation

```bash
npm install tx-indexer
```

### Quick Start

```typescript
import { createIndexer } from "tx-indexer";

const indexer = createIndexer({
  rpcUrl: "https://api.mainnet-beta.solana.com",
});

// Get wallet balance
const balance = await indexer.getBalance("YourWalletAddress...");
console.log(`SOL: ${balance.sol.ui}`);

// Get classified transactions
const transactions = await indexer.getTransactions("YourWalletAddress...", {
  limit: 10,
  filterSpam: true,
});

for (const { classification } of transactions) {
  console.log(
    `${classification.primaryType}: ${classification.primaryAmount?.amountUi} ${classification.primaryAmount?.token.symbol}`,
  );
}
```

### Transaction Types

| Type                                   | Description                              |
| -------------------------------------- | ---------------------------------------- |
| `transfer`                             | Wallet-to-wallet transfers               |
| `swap`                                 | Token exchanges (Jupiter, Raydium, Orca) |
| `privacy_deposit` / `privacy_withdraw` | Privacy Cash shield/unshield             |
| `nft_mint`                             | NFT minting                              |
| `nft_purchase` / `nft_sale`            | NFT trades                               |
| `stake_deposit` / `stake_withdraw`     | SOL staking                              |
| `bridge_in` / `bridge_out`             | Cross-chain bridges                      |
| `airdrop`                              | Token distributions                      |

### Supported Protocols

Jupiter, Raydium, Orca, Metaplex, Wormhole, deBridge, Pump.fun, Privacy Cash, and more.

---

## Project Structure

```
tx-indexer/
├── apps/
│   ├── dashboard/        # Wallet dashboard with privacy features
│   └── web/              # Landing page and transaction viewer
└── packages/
    ├── sdk/              # Main SDK (tx-indexer on npm)
    ├── core/             # Types, money handling, token registry
    ├── solana/           # RPC client, transaction fetching
    └── classification/   # Transaction classifier, protocol detection
```

## Development

```bash
bun install
bun run build
bun run typecheck
```

## License

MIT

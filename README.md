# TX Indexer

> **Note:** This project is currently under active development.

A modular Solana transaction indexer and classifier built for tracking, analyzing, and categorizing blockchain transactions with personal finance-like semantics.

## Overview

TX Indexer fetches transactions from Solana wallets, detects the protocols involved (Jupiter, Raydium, Orca, etc.), and provides a foundation for categorizing transactions similar to traditional financial tracking apps. The project is designed to transform raw blockchain data into meaningful financial insights.

## Architecture

This is a monorepo built with [Turborepo](https://turborepo.com) and [Bun](https://bun.com), organized into apps and shared packages.

### Apps

- **indexer** - CLI tool for fetching and analyzing Solana transactions
- **web** - Next.js web application (frontend)
- **docs** - Documentation site built with Next.js

### Packages

- **@repo/domain** - Core domain types and schemas for transactions, money, counterparties, and categorization
- **@repo/solana** - Solana-specific adapters for RPC communication, transaction fetching, and data mapping
- **@repo/classification** - Protocol detection and transaction classification logic
- **@repo/ui** - Shared React component library
- **@repo/eslint-config** - Shared ESLint configurations
- **@repo/typescript-config** - Shared TypeScript configurations

## Features

- **Transaction Fetching** - Retrieve transaction history for any Solana wallet address
- **Protocol Detection** - Automatically identify known protocols (Jupiter, Raydium, Orca, Metaplex, etc.)
- **Type-Safe Domain Models** - Zod schemas for transactions, tokens, counterparties, and categorization
- **Batch Processing** - Efficient parallel fetching of multiple transactions
- **Extensible Architecture** - Clean separation between blockchain adapters and domain logic

## Getting Started

### Prerequisites

- [Bun](https://bun.com) v1.3.4 or higher
- Node.js 18+ (for compatibility)

### Installation

```bash
# Install dependencies
bun install
```

### Running the Indexer

```bash
# Fetch transactions for a wallet
WALLET_ADDRESS=<your-solana-address> bun run apps/indexer/index.ts

# Optional: Use a custom RPC endpoint
RPC_URL=https://api.mainnet-beta.solana.com WALLET_ADDRESS=<address> bun run apps/indexer/index.ts
```

### Development

```bash
# Run all apps in development mode
bun run dev

# Run specific app
bun run dev --filter=web

# Type checking
bun run check-types

# Linting
bun run lint

# Format code
bun run format
```

### Building

```bash
# Build all packages and apps
bun run build

# Build specific package
bun run build --filter=solana
```

## Domain Model

The project uses a rich domain model with the following key concepts:

### Transactions
- **RawTransaction** - Low-level blockchain transaction data
- **TxPrimaryType** - Transfer, swap, NFT operations, staking, bridging, etc.
- **TxDirection** - Incoming, outgoing, self, or neutral
- **TxCategory** - Income, expense, transfer, investment, savings, fee, etc.

### Money & Tokens
- **TokenInfo** - Token metadata (mint, symbol, decimals)
- **MoneyAmount** - Amounts with both raw and UI-friendly representations
- **FiatValue** - Optional fiat conversion (USD, EUR)

### Counterparties
- **Counterparty** - Transaction counterparty (person, merchant, exchange, protocol, own wallet)
- **ProtocolInfo** - Detected protocol information
- **Categorization** - Budget categories, tags, and merchant associations

## Protocol Support

Currently detects the following Solana protocols:

- Jupiter & Jupiter V4 (DEX aggregator)
- Raydium (AMM)
- Orca Whirlpool (AMM)
- Metaplex (NFT standard)
- Token Program (SPL)
- System Program
- Associated Token Program
- Stake Program
- Compute Budget Program

## Technology Stack

- **Runtime** - Bun
- **Language** - TypeScript
- **Validation** - Zod
- **Blockchain** - Solana (@solana/kit)
- **Frontend** - Next.js 16, React 19
- **Monorepo** - Turborepo

## Project Structure

```
tx-indexer/
├── apps/
│   ├── indexer/       # CLI transaction indexer
│   ├── web/           # Web application
│   └── docs/          # Documentation site
├── packages/
│   ├── domain/        # Core domain types
│   ├── solana/        # Solana adapters
│   ├── classification/ # Protocol detection
│   ├── ui/            # Shared components
│   ├── eslint-config/ # Linting config
│   └── typescript-config/ # TypeScript config
└── README.md
```

## Roadmap

Future enhancements may include:

- Token balance tracking
- Fiat price integration
- Advanced categorization rules
- Multi-chain support
- Historical analysis and reporting
- Budget tracking features
- Export capabilities (CSV, JSON)

## Contributing

This is a monorepo managed by Turborepo. Each package is independently typed and follows strict TypeScript configurations.

## License

Private project - all rights reserved.

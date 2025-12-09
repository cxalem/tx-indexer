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

### Current Implementation

- **Transaction Fetching** - Retrieve transaction history for any Solana wallet address
- **Token Balance Tracking** - Track SOL and token (USDC) balance changes across transactions
- **Protocol Detection** - Automatically identify known protocols with priority system (Jupiter, Raydium, Orca, Metaplex, etc.)
- **Double-Entry Accounting** - TxLeg model converts raw transactions into balanced ledger entries
- **Type-Safe Domain Models** - Zod schemas for transactions, tokens, counterparties, and legs
- **Batch Processing** - Efficient parallel fetching of multiple transactions
- **Extensible Architecture** - Clean separation between blockchain adapters and domain logic

### Coming Soon

- **Classification Engine** - Interpret transaction legs to determine type (swap, transfer, airdrop, etc.)
- **UserTransaction Model** - UX-friendly transaction representation with titles, subtitles, and summaries
- **Counterparty Resolution** - Map addresses to known merchants, protocols, and contacts
- **REST API** - Query transactions, update categories, manage watch mode
- **Storage Layer** - Persist transactions with PostgreSQL/SQLite
- **Dashboard UI** - Bank-style transaction list with filtering and charts

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

## Data Architecture

The system uses a layered architecture to transform raw blockchain data into user-friendly insights:

```
RawTransaction (from Solana RPC)
    ↓
TxLeg[] (double-entry accounting)
    ↓
UserTransaction (UX-friendly)
```

### Core Data Models

#### 1. RawTransaction (Blockchain Layer)

Raw transaction data from Solana RPC:

```typescript
{
  signature: "abc123...",
  slot: 123456,
  blockTime: 1702345678,
  err: null,
  programIds: ["JUP6Lkb...", "TokenkegQ..."],
  protocol: { id: "jupiter", name: "Jupiter" },
  preTokenBalances: [...],
  postTokenBalances: [...],
  accountKeys: ["wallet1", "wallet2", ...]
}
```

#### 2. TxLeg (Accounting Layer)

Double-entry ledger representation:

```typescript
{
  accountId: "wallet:5vK8a1kE...hC3pN9x2",
  side: "debit",
  amount: {
    token: { mint: "SOL", symbol: "SOL", decimals: 9 },
    amountRaw: "100000000",
    amountUi: 0.1
  },
  role: "sent"
}
```

**Account ID Format:**
- `wallet:address` - User's wallet
- `protocol:jupiter:USDC:address` - Protocol interaction
- `external:address` - External party
- `fee:network` - Network fees

**Roles:**
- `sent`, `received` - Direct transfers
- `fee` - Transaction/network fees
- `reward` - Staking/protocol rewards
- `protocol_deposit`, `protocol_withdraw` - DeFi interactions
- `principal`, `interest` - Lending operations

**Example Transaction (Jupiter Swap):**
```typescript
[
  { accountId: "wallet:user", side: "debit", amount: 100 USDC, role: "sent" },
  { accountId: "protocol:jupiter:USDC:pool", side: "credit", amount: 100 USDC, role: "protocol_deposit" },
  { accountId: "protocol:jupiter:SOL:pool", side: "debit", amount: 0.5 SOL, role: "protocol_withdraw" },
  { accountId: "wallet:user", side: "credit", amount: 0.5 SOL, role: "received" },
  { accountId: "wallet:user", side: "debit", amount: 0.000005 SOL, role: "fee" },
  { accountId: "fee:network", side: "credit", amount: 0.000005 SOL, role: "fee" }
]
```

#### 3. UserTransaction (UX Layer - Coming Soon)

Human-friendly representation:

```typescript
{
  id: "abc123",
  title: "Swapped USDC for SOL",
  subtitle: "Via Jupiter",
  primaryAmount: { amount: -100, token: "USDC" },
  secondaryAmount: { amount: 0.5, token: "SOL" },
  netFiatImpact: -2.50,
  direction: "neutral",
  category: "investment",
  counterparty: { type: "protocol", name: "Jupiter" },
  legs: [...],  // Full accounting details
  raw: {...}    // Original RawTransaction
}
```

### Additional Models

#### Money & Tokens
- **TokenInfo** - Token metadata (mint, symbol, decimals, logo)
- **MoneyAmount** - Amounts with raw and UI representations
- **FiatValue** - Optional fiat conversion (USD, EUR)

#### Counterparties & Classification
- **Counterparty** - Transaction party (person, merchant, exchange, protocol)
- **ProtocolInfo** - Detected protocol information
- **Categorization** - Budget categories, tags, merchant associations
- **TxPrimaryType** - Transfer, swap, NFT, staking, etc.
- **TxCategory** - Income, expense, investment, etc.

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

## API Endpoints (Planned)

The system will expose a REST API for frontend integration:

### Transaction Queries

```
GET /api/wallets/:address/transactions
  ?limit=50
  &offset=0
  &category=expense
  &startDate=2024-01-01
  &endDate=2024-12-31
  
Response: {
  transactions: UserTransaction[],
  total: 1234,
  hasMore: true
}
```

```
GET /api/transactions/:signature
Response: UserTransaction (with full legs)
```

### Watch Mode Management

```
POST /api/watch
Body: { address: "...", label: "Main Wallet" }
Response: { id: "...", status: "indexing" }

GET /api/watch
Response: { wallets: [...], status: [...] }

DELETE /api/watch/:id
```

### Categorization & Editing

```
PATCH /api/transactions/:signature/category
Body: { category: "food_dining", tags: ["business"] }

POST /api/counterparties/:address/label
Body: { name: "Starbucks", type: "merchant" }
```

### Analytics

```
GET /api/analytics/spending
  ?period=month
  &groupBy=category
  
Response: {
  byCategory: { food_dining: 450.50, transport: 120.00 },
  total: 1234.56,
  trend: "up"
}
```

## Roadmap

### Phase 1: Foundation (Current)
- ✅ Transaction fetching from Solana RPC
- ✅ Token balance parsing (SOL, USDC)
- ✅ Protocol detection with priority
- ✅ TxLeg model for double-entry accounting
- ✅ Leg validation and balance checking

### Phase 2: Intelligence (Next)
- ⏳ Classification engine (detect swaps, transfers, airdrops)
- ⏳ UserTransaction model with titles/subtitles
- ⏳ Counterparty resolution
- ⏳ Relevance filtering (hide dust/spam)
- ⏳ Fiat price integration

### Phase 3: Persistence
- 📋 Database schema design
- 📋 Transaction storage (PostgreSQL/SQLite)
- 📋 Watch mode implementation
- 📋 Backfill historical data
- 📋 Real-time indexing

### Phase 4: API & UI
- 📋 REST API endpoints
- 📋 Dashboard UI (bank-style statement)
- 📋 Filtering and search
- 📋 Category editing
- 📋 Charts and analytics

### Phase 5: Advanced Features
- 📋 Multi-token support (all SPL tokens)
- 📋 Advanced categorization rules
- 📋 Budget tracking
- 📋 Export capabilities (CSV, JSON)
- 📋 Multi-chain support

## Contributing

This is a monorepo managed by Turborepo. Each package is independently typed and follows strict TypeScript configurations.

## License

Private project - all rights reserved.

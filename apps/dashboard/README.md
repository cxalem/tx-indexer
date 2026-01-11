# TX Indexer Dashboard

A non-custodial Solana wallet dashboard built with Next.js and the tx-indexer SDK.

## Features

- Real-time wallet balance display (SOL and SPL tokens)
- Transaction history with automatic classification
- Spam transaction filtering
- Support for rate-limited RPCs with optimization options
- Server-side transaction fetching for security
- Client-side wallet operations with domain-restricted keys

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Solana RPC URL (Helius, QuickNode, or public endpoint)

### Installation

```bash
cd apps/dashboard
bun install
```

### Environment Setup

Create a `.env.local` file based on `.env.example`:

```bash
cp .env.example .env.local
```

Configure your environment variables:

```bash
# Server-side RPC (unrestricted key, never exposed to browser)
SERVER_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_SERVER_KEY

# Client-side RPC (domain-restricted key for wallet operations)
NEXT_PUBLIC_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_PUBLIC_KEY

# Optional: Enable aggressive optimization for rate-limited RPCs
OPTIMIZE_FOR_RATE_LIMITS=true
```

**Security Note:** Use separate API keys for server and client:

- `SERVER_RPC_URL`: Unrestricted key for server actions and API routes
- `NEXT_PUBLIC_RPC_URL`: Domain-restricted key for client-side wallet operations

### Development

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## RPC Optimization

For rate-limited RPCs (like Helius free tier at 10 req/sec), set:

```bash
OPTIMIZE_FOR_RATE_LIMITS=true
```

This enables:

- `overfetchMultiplier: 1` - Reduces signature overfetch
- `minPageSize` matching your limit - Reduces RPC calls
- Smart token account fetching - Only queries ATAs when needed

These optimizations can reduce load time from ~105s to ~7s.

## Architecture

```
apps/dashboard/
├── app/
│   ├── actions/           # Server actions for secure RPC calls
│   │   ├── dashboard.ts   # Transaction fetching with optimization
│   │   └── estimate-fee.ts
│   └── page.tsx           # Main dashboard page
├── components/
│   ├── providers.tsx      # Wallet and RPC providers
│   └── ...                # UI components
└── lib/
    └── indexer.ts         # SDK configuration
```

## Learn More

- [tx-indexer SDK Documentation](../../packages/sdk/README.md)
- [Next.js Documentation](https://nextjs.org/docs)

## License

MIT

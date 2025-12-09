# Solana Transaction Indexer API

REST API for enriched Solana transaction data with human-friendly classifications.

## Features

- 🔍 **Transaction Classification** - Automatically identifies transaction types (transfer, swap, airdrop)
- 💰 **Balance Tracking** - Real-time SOL and SPL token balances
- 📊 **Double-Entry Accounting** - Full accounting legs for each transaction
- 🎯 **Smart Filtering** - Spam and dust transaction filtering
- 🚀 **Fast & Cached** - KV caching for optimal performance
- 🌐 **CORS Enabled** - Ready for browser-based applications

## Base URL

**Local Development:**
```
http://localhost:8787
```

**Production:**
```
https://your-worker.workers.dev
```

---

## Endpoints

### GET `/`

**List all available endpoints**

Returns API information and endpoint documentation.

**Response:**
```json
{
  "name": "Solana Transaction Indexer API",
  "version": "1.0.0",
  "endpoints": [...]
}
```

---

### GET `/api/v1/health`

**Health check and RPC connectivity**

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "rpc": {
      "status": "connected",
      "url": "https://mainnet.helius-rpc.com/..."
    }
  },
  "meta": {
    "timestamp": "2025-12-09T15:00:00.000Z",
    "version": "1.0.0"
  }
}
```

---

### GET `/api/v1/wallet/:address/balance`

**Get wallet SOL and token balances**

Returns current balances for SOL and all SPL tokens with non-zero amounts.

**Parameters:**
- `address` (path) - Solana wallet address (base58)

**Example:**
```bash
curl http://localhost:8787/api/v1/wallet/Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9/balance
```

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": "Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9",
    "timestamp": "2025-12-09T15:00:00.000Z",
    "balances": [
      {
        "token": "SOL",
        "symbol": "SOL",
        "amount": 2.691118332,
        "decimals": 9
      },
      {
        "token": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "symbol": "USDC",
        "amount": 2018.532613,
        "decimals": 6
      }
    ]
  },
  "meta": {
    "timestamp": "2025-12-09T15:00:00.000Z",
    "version": "1.0.0"
  }
}
```

**Caching:** 30 seconds

---

### GET `/api/v1/wallet/:address/transactions`

**Get wallet transaction history with pagination**

Returns classified transaction history with automatic spam filtering.

**Parameters:**
- `address` (path) - Solana wallet address (base58)
- `limit` (query, optional) - Number of transactions (1-100, default: 10)
- `before` (query, optional) - Cursor for pagination (transaction signature)

**Example:**
```bash
# First page
curl http://localhost:8787/api/v1/wallet/Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9/transactions?limit=5

# Next page
curl http://localhost:8787/api/v1/wallet/Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9/transactions?limit=5&before=5x...ABC
```

**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": "Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9",
    "transactions": [
      {
        "signature": "5x...ABC",
        "blockTime": 1765241073,
        "status": "success",
        "type": "transfer",
        "direction": "outgoing",
        "primaryAmount": {
          "token": "USDC",
          "amount": 100.5,
          "decimals": 6
        },
        "counterparty": {
          "name": "Unknown",
          "address": "CmGgLQL..."
        },
        "fee": 0.000005,
        "memo": "Payment for services",
        "facilitator": "payai"
      }
    ],
    "pagination": {
      "limit": 5,
      "count": 5,
      "hasMore": true,
      "nextCursor": "5x...ABC"
    }
  },
  "meta": {
    "timestamp": "2025-12-09T15:00:00.000Z",
    "version": "1.0.0"
  }
}
```

**Transaction Types:**
- `transfer` - Simple token transfer
- `swap` - Token swap (DEX)
- `airdrop` - Token airdrop/claim
- `fee_only` - Transaction with only network fees

**Direction:**
- `incoming` - Tokens received (credit)
- `outgoing` - Tokens sent (debit)
- `neutral` - Both (e.g., swaps)

**Facilitator:**
- `payai` - PayAI x402 payment facilitator
- `null` - No known facilitator

**Caching:** 30 seconds

---

### GET `/api/v1/transaction/:signature`

**Get single transaction details with accounting**

Returns detailed transaction classification with double-entry accounting breakdown.

**Parameters:**
- `signature` (path) - Transaction signature (base58, 88 characters)

**Example:**
```bash
curl http://localhost:8787/api/v1/transaction/5x...ABC
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signature": "5x...ABC",
    "blockTime": 1765241073,
    "slot": 377750116,
    "status": "success",
    "classification": {
      "type": "transfer",
      "direction": "outgoing",
      "primaryAmount": {
        "token": "USDC",
        "amount": 100.5,
        "decimals": 6
      },
      "counterparty": {
        "name": "Unknown",
        "address": "CmGgLQL..."
      },
      "confidence": 0.95,
      "memo": "Payment for services",
      "facilitator": "payai"
    },
    "accounting": {
      "legs": [
        {
          "accountId": "wallet:Hb6d...",
          "side": "debit",
          "amount": {
            "token": "USDC",
            "amountUi": 100.5,
            "decimals": 6
          },
          "role": "sent"
        },
        {
          "accountId": "external:CmGgLQL...",
          "side": "credit",
          "amount": {
            "token": "USDC",
            "amountUi": 100.5,
            "decimals": 6
          },
          "role": "received"
        },
        {
          "accountId": "fee:network",
          "side": "debit",
          "amount": {
            "token": "SOL",
            "amountUi": 0.000005,
            "decimals": 9
          },
          "role": "fee"
        }
      ],
      "balanced": true
    },
    "protocol": {
      "id": "system",
      "name": "System Program"
    },
    "fee": 0.000005
  },
  "meta": {
    "timestamp": "2025-12-09T15:00:00.000Z",
    "version": "1.0.0"
  }
}
```

**Caching:** 5 minutes (300 seconds)

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "meta": {
    "timestamp": "2025-12-09T15:00:00.000Z",
    "version": "1.0.0"
  }
}
```

**Common Error Codes:**

- `INVALID_ADDRESS` (400) - Invalid wallet address format
- `INVALID_SIGNATURE` (400) - Invalid transaction signature format
- `VALIDATION_ERROR` (400) - Invalid query parameters
- `NOT_FOUND` (404) - Transaction not found
- `RPC_ERROR` (503) - Solana RPC connection failed
- `INTERNAL_ERROR` (500) - Internal server error

---

## Development

**Prerequisites:**
- Bun >= 1.0
- Wrangler >= 4.0

**Setup:**
```bash
cd apps/api
bun install

# Create .dev.vars with your RPC URL
echo 'RPC_URL="https://your-helius-rpc-url"' > .dev.vars

# Start development server
bun run dev
```

**Type Checking:**
```bash
bun run check-types
```

**Deploy:**
```bash
# Set production RPC URL
bunx wrangler secret put RPC_URL

# Deploy to Cloudflare Workers
bun run deploy
```

---

## Configuration

**Environment Variables:**

- `RPC_URL` - Solana RPC endpoint (required)

**Caching:**

- Balance endpoint: 30 seconds TTL
- Transactions list: 30 seconds TTL
- Single transaction: 5 minutes TTL

**Spam Filter:**

- Minimum SOL amount: 0.001
- Minimum token USD value: $0.01
- Minimum confidence: 0.5
- Failed transactions: filtered out

---

## Architecture

**Built with:**
- [Hono](https://hono.dev/) - Fast web framework for Workers
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless platform
- [Cloudflare KV](https://developers.cloudflare.com/kv/) - Key-value storage for caching
- [@solana/kit](https://github.com/anza-xyz/solana-web3.js) - Solana SDK
- [Zod](https://zod.dev/) - Schema validation

**Packages:**
- `@solana/fetcher` - RPC data fetching
- `@solana/mappers` - Transaction parsing and memo extraction
- `@classification/engine` - Transaction classification system
- `@domain/tx` - Transaction types and validation
- `@domain/money` - Token registry and money types

---

## License

MIT


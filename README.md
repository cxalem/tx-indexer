# TX Indexer

A Solana transaction indexer that transforms raw blockchain transactions into categorized, user-friendly financial data.

> 🚧 Under active development

## Overview

TX Indexer fetches Solana transactions and converts them into meaningful financial insights through a three-layer architecture:

```
RawTransaction → TxLeg[] → TransactionClassification
```

## Core Data Models

### 1. RawTransaction (Blockchain Layer)

Raw transaction data from Solana RPC including balance changes, program IDs, and optional memo instructions.

```typescript
{
  signature: string;
  slot: number;
  blockTime: number;
  programIds: string[];
  protocol: { name: "Jupiter", type: "dex" } | null;
  preTokenBalances: TokenBalance[];
  postTokenBalances: TokenBalance[];
  memo?: string;  // Solana Pay support
}
```

### 2. TxLeg (Accounting Layer)

Double-entry bookkeeping representation with structured account identifiers:

```typescript
{
  accountId: string;        // "wallet:addr", "protocol:jupiter:USDC:addr", "fee:network"
  side: "debit" | "credit";
  amount: MoneyAmount;
  role: "sent" | "received" | "fee" | "protocol_deposit" | "protocol_withdraw";
}
```

**Example - Token Swap:**
```typescript
[
  { accountId: "wallet:user", side: "debit", amount: 100 USDC, role: "sent" },
  { accountId: "protocol:jupiter:USDC", side: "credit", amount: 100 USDC, role: "protocol_deposit" },
  { accountId: "protocol:jupiter:SOL", side: "debit", amount: 0.5 SOL, role: "protocol_withdraw" },
  { accountId: "wallet:user", side: "credit", amount: 0.5 SOL, role: "received" },
  { accountId: "fee:network", side: "credit", amount: 0.000005 SOL, role: "fee" }
]
```

### 3. TransactionClassification (UX Layer)

User-friendly categorization with confidence scoring:

```typescript
{
  primaryType: "transfer" | "swap" | "airdrop" | "fee_only";
  direction: "incoming" | "outgoing" | "neutral";
  primaryAmount: MoneyAmount;
  secondaryAmount?: MoneyAmount;  // For swaps
  counterparty?: {
    name: string;
    address: string;
    type: "wallet" | "protocol" | "merchant";
  };
  confidence: number;  // 0.0 - 1.0
  isRelevant: boolean;
  metadata: {
    payment_type?: "solana_pay";
    merchant?: string;
    // ... additional context
  }
}
```

## Classification Engine

Automatic transaction categorization using priority-based classifiers:

| Priority | Classifier | Detects |
|----------|------------|---------|
| 95 | Solana Pay | Payments with merchant metadata in memo |
| 80 | Swap | Token exchanges (Jupiter, Raydium, Orca) |
| 70 | Airdrop | Token distributions (receive only) |
| 50 | Transfer | Simple wallet-to-wallet transfers |
| 60 | Fee Only | Transactions with only network fees |

Classifiers run in priority order. The first match determines the transaction type.

## Output Examples

### Wallet Transaction History

```
TX Indexer
============================================

Current Balance
--------------------------------------------
Address: CmGgLQL3...PPhUWNqv
SOL: 0.000000000
USDC: 2.110000

Recent Transactions
--------------------------------------------

1. 56sXKPNAPSE...
   Status: Success
   Protocol: Associated Token Program
   Time: 11/4/2025, 12:31:59 AM
   Balance Changes:
     USDC: +0.010000

   Classification:
     Type: airdrop
     Direction: incoming
     Amount: 0.010000 USDC
     Confidence: 0.85
     Relevant: Yes

   Transaction Legs (5 total):
     fee: -0.002049281 SOL
     received: +0.010000 USDC
     ...
```

### Single Transaction Classification

```
Transaction: 32UwwoheTh3NUzdy...
Status: Success
Protocol: Token Program
Time: 12/3/2025, 2:15:21 PM

Memo: [binary reference data]

Classification:
  Type: transfer
  Direction: incoming
  Amount: 0.120000 USDC
  Payment Type: Solana Pay
  Confidence: 0.98
  Relevant: Yes

Transaction Legs (4 total):
  fee: -0.000005000 SOL
    Account: external:Hb6dzd4p...
  received: +0.120000 USDC
    Account: wallet:CmGgLQL3...
  protocol_deposit: -0.120000 USDC
    Account: protocol:spl-token:USDC:Hb6dzd4p...

✓ Legs are balanced
```

## Supported Protocols

- **DEX:** Jupiter, Raydium, Orca Whirlpool
- **NFT:** Metaplex
- **Core:** Token Program, System Program, Associated Token Program, Stake Program
- **Payments:** Solana Pay (SPL Memo)

## Features

✅ Transaction fetching and parsing  
✅ Double-entry bookkeeping validation  
✅ Automatic protocol detection  
✅ Transaction classification (5 types)  
✅ Solana Pay memo extraction  
✅ Token balance tracking  
✅ Type-safe (TypeScript + Zod)  

🔜 REST API  
🔜 Database persistence  
🔜 Real-time subscriptions  

## Technology

- **Runtime:** Bun
- **Language:** TypeScript
- **Blockchain:** Solana (@solana/kit v5)
- **Validation:** Zod
- **Monorepo:** Turborepo

---

**License:** MIT

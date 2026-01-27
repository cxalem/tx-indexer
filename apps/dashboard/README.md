# itx Dashboard

A non-custodial Solana wallet dashboard with privacy features, built with Next.js.

---

## Privacy flow

The **Privacy Hub** implementation can be found in:

| Component           | Path                                    | Description                             |
| ------------------- | --------------------------------------- | --------------------------------------- |
| Privacy Drawer      | `components/privacy/privacy-drawer.tsx` | Main UI for deposit/withdraw operations |
| Privacy Cash Client | `lib/privacy/privacy-cash-client.ts`    | SDK wrapper for ZK proof generation     |
| Privacy Hook        | `hooks/use-privacy-cash.ts`             | React hook managing privacy operations  |
| Private Swap        | `hooks/use-private-swap.ts`             | Private token swap flow                 |
| Constants           | `lib/privacy/constants.ts`              | Supported tokens and config             |

**Flow:** User deposits funds → ZK proof generated → Funds shielded → Private transfers/swaps → Withdraw to any address (unlinkable)

---

## Features

- **Send and Receive** - Transfer SOL and tokens with labeled contacts
- **Trade** - Swap tokens via Jupiter aggregator
- **Privacy Hub** - Shield funds with zero-knowledge proofs, send privately
- **Activity Feed** - Classified transaction history, organized by day
- **Spam Filtering** - Automatic dust and spam token filtering
- **Real-time Updates** - Live polling with sound notifications

## Getting Started

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env.local

# Run development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

```bash
# Server-side RPC (unrestricted key)
SERVER_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Client-side RPC (domain-restricted key)
NEXT_PUBLIC_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_PUBLIC_KEY

# Optional: Optimize for rate-limited RPCs
OPTIMIZE_FOR_RATE_LIMITS=true

# Optional: Supabase (for wallet labels and sign-in)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Database Setup (Optional)

If using Supabase for wallet labels, create this table:

```sql
create table wallet_labels (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  address text not null,
  label text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, address)
);

-- Enable RLS
alter table wallet_labels enable row level security;

-- Users can only access their own labels
create policy "Users can manage own labels"
  on wallet_labels for all
  using (auth.uid() = user_id);
```

## License

MIT

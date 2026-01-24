# Privacy Cash SDK Implementation Guide

## Overview

Privacy Cash is a privacy protocol for Solana using ZK proofs. The SDK provides two usage patterns:

1. **Node.js (Backend)**: Uses the `PrivacyCash` class with a private key
2. **Browser (Frontend)**: Uses individual exported functions with wallet adapter

## Architecture

### Key Flow

```
1. User signs message "Privacy Money account sign in"
2. Signature → EncryptionService.deriveEncryptionKeyFromSignature()
3. EncryptionService derives UTXO keypair for encrypting/decrypting balance data
4. Deposit: User signs tx → relayed to Privacy Cash backend → confirmed on-chain
5. Withdraw: ZK proof generated client-side → sent to relayer → relayer submits tx
```

### Important: Deposits require user signing, Withdrawals are relayed

- **Deposit**: User signs the transaction, then it's relayed to the indexer backend
- **Withdraw**: User generates ZK proof client-side, sends proof data to relayer, relayer submits and pays fees

## Package Exports

### Main Export (`privacycash`)

```typescript
// Node.js only - imports node-localstorage
export class PrivacyCash { ... }
```

### Utils Export (`privacycash/utils`)

```typescript
export { getConfig } from "./config.js";
export { deposit } from "./deposit.js";
export { withdraw } from "./withdraw.js";
export { EncryptionService } from "./utils/encryption.js";
export { setLogger } from "./utils/logger.js";
export { getBalanceFromUtxos, getUtxos, localstorageKey } from "./getUtxos.js";
export { depositSPL } from "./depositSPL.js";
export { withdrawSPL } from "./withdrawSPL.js";
export { getBalanceFromUtxosSPL, getUtxosSPL } from "./getUtxosSPL.js";
export { type TokenList, type SplList, tokens } from "./utils/constants.js";
```

## Core Types

### DepositParams

```typescript
type DepositParams = {
  publicKey: PublicKey;
  connection: Connection;
  amount_in_lamports: number;
  storage: Storage; // localStorage in browser
  encryptionService: EncryptionService;
  keyBasePath: string; // '/circuit2' for browser
  lightWasm: hasher.LightWasm;
  referrer?: string;
  signer?: PublicKey;
  transactionSigner: (
    tx: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
};
```

### WithdrawParams

```typescript
type WithdrawParams = {
  publicKey: PublicKey;
  connection: Connection;
  amount_in_lamports: number;
  keyBasePath: string;
  encryptionService: EncryptionService;
  lightWasm: hasher.LightWasm;
  recipient: PublicKey;
  storage: Storage;
  referrer?: string;
};
```

Note: Withdraw does NOT have `transactionSigner` - the relayer signs and submits.

### EncryptionService

```typescript
class EncryptionService {
  // Initialize from wallet signature (browser)
  deriveEncryptionKeyFromSignature(signature: Uint8Array): EncryptionKey;

  // Initialize from keypair (Node.js)
  deriveEncryptionKeyFromWallet(keypair: Keypair): EncryptionKey;

  // Encrypt/decrypt UTXOs
  encryptUtxo(utxo: Utxo): Buffer;
  decryptUtxo(encryptedData: Buffer | string, lightWasm?: any): Promise<Utxo>;

  // Get derived keys
  getUtxoPrivateKeyV1(): string;
  getUtxoPrivateKeyV2(): string;
}
```

## Browser Integration Pattern

From the official gist:

```typescript
// 1. Initialize WASM
const { WasmFactory } = await import("@lightprotocol/hasher.rs");
const lightWasm = await WasmFactory.getInstance();

// 2. Get user signature for encryption key derivation
const encodedMessage = new TextEncoder().encode(
  "Privacy Money account sign in",
);
const signature = await wallet.signMessage(encodedMessage);

// 3. Initialize encryption service
const encryptionService = new EncryptionService();
encryptionService.deriveEncryptionKeyFromSignature(signature);

// 4. Deposit SOL
await deposit({
  lightWasm,
  connection,
  amount_in_lamports: amount,
  keyBasePath: "/circuit2", // Static path for browser
  publicKey: wallet.publicKey,
  transactionSigner: async (tx) => await wallet.signTransaction(tx),
  storage: localStorage,
  encryptionService,
});

// 5. Withdraw SOL (no transactionSigner needed - relayer handles it)
await withdraw({
  lightWasm,
  connection,
  amount_in_lamports: amount,
  keyBasePath: "/circuit2",
  publicKey: wallet.publicKey,
  storage: localStorage,
  encryptionService,
  recipient: recipientAddress,
});

// 6. Get balance
const utxos = await getUtxos({
  publicKey: wallet.publicKey,
  connection,
  encryptionService,
  storage: localStorage,
});
const { lamports } = getBalanceFromUtxos(utxos);
```

## Key Implementation Details

### Transaction Signing (Deposit only)

```typescript
transactionSigner: async (tx: VersionedTransaction) => {
  return await wallet.signTransaction(tx);
};
```

The signed transaction is then relayed to the Privacy Cash backend, not submitted directly.

### Storage

- Browser: Pass `localStorage` directly
- Node.js: SDK uses `node-localstorage` internally

### keyBasePath

- Browser: `'/circuit2'` - the SDK fetches circuit files from this path
- Node.js: `path.join(import.meta.dirname, '..', 'circuit2', 'transaction2')`

### Circuit Files

The SDK needs WASM circuit files for ZK proof generation:

- `circuit2/transaction2.wasm`
- `circuit2/transaction2.zkey`

In browser, these are fetched from the `keyBasePath` URL.

## Why the SDK Main Export Doesn't Work in Browser

```typescript
// index.ts imports Node.js-only modules at top level:
import { LocalStorage } from "node-localstorage";
import path from "node:path";

let storage = new LocalStorage(path.join(process.cwd(), "cache"));
```

The `PrivacyCash` class is designed for Node.js with a private key. Browser usage requires the individual functions that accept `storage` as a parameter.

## Browser-Compatible Imports

The individual function files (`deposit.js`, `withdraw.js`, etc.) ARE browser-compatible because they:

1. Accept `storage` as a parameter instead of importing `node-localstorage`
2. Accept `transactionSigner` callback for wallet signing
3. Don't use Node.js-specific APIs

But they're not properly exported in `package.json`. Options:

1. Use dynamic imports bypassing module resolution
2. Use the `privacycash/utils` export (if it works)
3. Fork the SDK to add proper browser exports

## Constants

```typescript
// Program ID
const PROGRAM_ID = new PublicKey(
  "9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD",
);

// Supported tokens
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDT_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

// Relayer API
const RELAYER_API_URL = "https://api3.privacycash.org";
```

## Relayer Architecture

Privacy Cash uses a relayer model:

1. **Deposits**: User signs tx → relayed to backend → backend submits to Solana
2. **Withdrawals**: User creates ZK proof → sends proof data to relayer → relayer creates & submits tx

This means:

- Users don't need SOL for withdraw gas fees (relayer pays)
- Withdraw fees are deducted from the withdrawn amount
- The relayer never has custody of funds (ZK proofs ensure only the owner can withdraw)

## Fee Structure

```typescript
// Withdraw fee calculation
let fee_in_lamports = Math.floor(
  amount_in_lamports * (await getConfig("withdraw_fee_rate")) +
    LAMPORTS_PER_SOL * (await getConfig("withdraw_rent_fee")),
);
```

## Return Types

### deposit()

```typescript
{
  tx: string;
} // Transaction signature
```

### withdraw()

```typescript
{
  isPartial: boolean,     // true if balance was less than requested
  tx: string,             // Transaction signature
  recipient: string,      // Recipient address
  amount_in_lamports: number,
  fee_in_lamports: number
}
```

### getBalanceFromUtxos()

```typescript
{
  lamports: number;
}
```

### getBalanceFromUtxosSPL()

```typescript
{ base_units: number, amount: number, lamports: number }
```

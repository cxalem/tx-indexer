"use client";

import {
  Connection,
  PublicKey,
  VersionedTransaction,
  Keypair,
} from "@solana/web3.js";
import {
  PRIVACY_CASH_SUPPORTED_TOKENS,
  PRIVACY_CASH_CIRCUIT_URL,
  PRIVACY_CASH_SIGN_MESSAGE,
  STORAGE_KEY_UTXO_CACHE_PREFIX,
  type PrivacyCashToken,
} from "./constants";

const DEBUG = process.env.NODE_ENV === "development";
const SIGNATURE_CACHE_KEY_PREFIX = "privacycash-signature-";

const debugLog = (...args: Parameters<typeof console.log>) => {
  if (DEBUG) console.log(...args);
};

const debugError = (...args: Parameters<typeof console.error>) => {
  if (DEBUG) console.error(...args);
};

export interface PrivacyCashClientConfig {
  connection: Connection;
  publicKey: PublicKey;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

export interface PrivacyBalance {
  amount: number;
  token: PrivacyCashToken;
  rawAmount: bigint;
}

export interface PrivacyCashResult {
  signature: string;
  isPartial?: boolean;
  fee?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdkModule: typeof import("privacycash/utils") | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lightWasmInstance: any = null;

async function loadSDK() {
  if (!sdkModule) {
    sdkModule = await import("privacycash/utils");
  }
  return sdkModule;
}

async function getLightWasm() {
  if (!lightWasmInstance) {
    const hasher = await import("@lightprotocol/hasher.rs");
    lightWasmInstance = await hasher.WasmFactory.getInstance();
  }
  return lightWasmInstance;
}

function getSignatureCacheKey(publicKey: string): string {
  return `${SIGNATURE_CACHE_KEY_PREFIX}${publicKey}`;
}

function getCachedSignature(publicKey: string): Uint8Array | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(getSignatureCacheKey(publicKey));
    if (!cached) return null;
    const arr = JSON.parse(cached);
    if (!Array.isArray(arr)) return null;
    return new Uint8Array(arr);
  } catch {
    return null;
  }
}

function cacheSignature(publicKey: string, signature: Uint8Array): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      getSignatureCacheKey(publicKey),
      JSON.stringify(Array.from(signature)),
    );
  } catch {}
}

function normalizeSignature(result: unknown): Uint8Array {
  if (
    result &&
    typeof result === "object" &&
    "signature" in result &&
    (result as { signature: unknown }).signature instanceof Uint8Array
  ) {
    return (result as { signature: Uint8Array }).signature;
  }
  if (result instanceof Uint8Array) {
    return result;
  }
  throw new Error("Signature is not a Uint8Array");
}

function isUserRejection(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("user rejected") || msg.includes("rejected");
}

export class PrivacyCashClient {
  private readonly connection: Connection;
  private readonly publicKey: PublicKey;
  private readonly signTransaction: (
    tx: VersionedTransaction,
  ) => Promise<VersionedTransaction>;
  private readonly signMessage: (message: Uint8Array) => Promise<Uint8Array>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private encryptionService: any = null;
  private initialized = false;

  constructor(config: PrivacyCashClientConfig) {
    this.connection = config.connection;
    this.publicKey = config.publicKey;
    this.signTransaction = config.signTransaction;
    this.signMessage = config.signMessage;
  }

  private getMintAddress(token: PrivacyCashToken): PublicKey {
    const tokenInfo = PRIVACY_CASH_SUPPORTED_TOKENS[token];
    if (!tokenInfo.mint) {
      throw new Error(`Token ${token} does not have a mint address`);
    }
    return new PublicKey(tokenInfo.mint);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const sdk = await loadSDK();
    const publicKeyBase58 = this.publicKey.toBase58();

    let signature = getCachedSignature(publicKeyBase58);

    if (!signature) {
      const capturedPublicKey = publicKeyBase58;
      const message = new TextEncoder().encode(PRIVACY_CASH_SIGN_MESSAGE);

      let rawSignature: unknown;
      try {
        rawSignature = await this.signMessage(message);
      } catch (err) {
        if (isUserRejection(err)) {
          throw new Error("User rejected the signature request");
        }
        throw err;
      }

      signature = normalizeSignature(rawSignature);

      if (this.publicKey.toBase58() !== capturedPublicKey) {
        throw new Error(
          "Don't switch accounts while signing in. Refresh and try again.",
        );
      }

      cacheSignature(publicKeyBase58, signature);
    }

    this.encryptionService = new sdk.EncryptionService();
    this.encryptionService.deriveEncryptionKeyFromSignature(signature);
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async getBalance(token: PrivacyCashToken): Promise<PrivacyBalance> {
    await this.ensureInitialized();
    const sdk = await loadSDK();
    const tokenInfo = PRIVACY_CASH_SUPPORTED_TOKENS[token];

    if (token === "SOL") {
      const utxos = await sdk.getUtxos({
        publicKey: this.publicKey,
        connection: this.connection,
        encryptionService: this.encryptionService,
        storage: localStorage,
      });
      if (!utxos || utxos.length === 0) {
        return {
          amount: 0,
          token: "SOL",
          rawAmount: BigInt(0),
        };
      }
      const { lamports } = sdk.getBalanceFromUtxos(utxos);
      return {
        amount: lamports / 1e9,
        token: "SOL",
        rawAmount: BigInt(lamports),
      };
    }

    const mintAddress = this.getMintAddress(token);
    const utxos = await sdk.getUtxosSPL({
      publicKey: this.publicKey,
      connection: this.connection,
      encryptionService: this.encryptionService,
      storage: localStorage,
      mintAddress,
    });
    if (!utxos || utxos.length === 0) {
      return {
        amount: 0,
        token,
        rawAmount: BigInt(0),
      };
    }
    const { base_units } = sdk.getBalanceFromUtxosSPL(utxos);
    return {
      amount: base_units / Math.pow(10, tokenInfo.decimals),
      token,
      rawAmount: BigInt(base_units),
    };
  }

  async deposit(
    amount: number,
    token: PrivacyCashToken,
  ): Promise<PrivacyCashResult> {
    await this.ensureInitialized();
    const sdk = await loadSDK();
    const lightWasm = await getLightWasm();
    const tokenInfo = PRIVACY_CASH_SUPPORTED_TOKENS[token];

    if (token === "SOL") {
      debugLog("[PrivacyCash] Starting SOL deposit:", {
        amount,
        lamports: Math.floor(amount * 1e9),
        publicKey: this.publicKey.toBase58(),
        circuitUrl: PRIVACY_CASH_CIRCUIT_URL,
      });
      try {
        const result = await sdk.deposit({
          lightWasm,
          connection: this.connection,
          amount_in_lamports: Math.floor(amount * 1e9),
          keyBasePath: PRIVACY_CASH_CIRCUIT_URL,
          publicKey: this.publicKey,
          transactionSigner: this.signTransaction,
          storage: localStorage,
          encryptionService: this.encryptionService,
        });
        debugLog("[PrivacyCash] SOL deposit result:", result);
        return { signature: result.tx };
      } catch (err) {
        debugError("[PrivacyCash] SOL deposit error:", err);
        debugError(
          "[PrivacyCash] Error stack:",
          err instanceof Error ? err.stack : "no stack",
        );
        throw err;
      }
    }

    const mintAddress = this.getMintAddress(token);

    try {
      const result = await sdk.depositSPL({
        lightWasm,
        connection: this.connection,
        base_units: Math.floor(amount * Math.pow(10, tokenInfo.decimals)),
        keyBasePath: PRIVACY_CASH_CIRCUIT_URL,
        publicKey: this.publicKey,
        transactionSigner: this.signTransaction,
        storage: localStorage,
        encryptionService: this.encryptionService,
        mintAddress,
      });
      return { signature: result.tx };
    } catch (err) {
      debugError("[PrivacyCash] depositSPL error:", err);
      throw err;
    }
  }

  async withdraw(
    amount: number,
    token: PrivacyCashToken,
    recipientAddress: string,
  ): Promise<PrivacyCashResult> {
    await this.ensureInitialized();
    const sdk = await loadSDK();
    const lightWasm = await getLightWasm();
    const tokenInfo = PRIVACY_CASH_SUPPORTED_TOKENS[token];

    if (token === "SOL") {
      const result = await sdk.withdraw({
        lightWasm,
        connection: this.connection,
        amount_in_lamports: Math.floor(amount * 1e9),
        keyBasePath: PRIVACY_CASH_CIRCUIT_URL,
        publicKey: this.publicKey,
        storage: localStorage,
        encryptionService: this.encryptionService,
        recipient: new PublicKey(recipientAddress),
      });
      return {
        signature: result.tx,
        isPartial: result.isPartial,
        fee: result.fee_in_lamports / 1e9,
      };
    }

    const mintAddress = this.getMintAddress(token);

    const result = await sdk.withdrawSPL({
      lightWasm,
      connection: this.connection,
      base_units: Math.floor(amount * Math.pow(10, tokenInfo.decimals)),
      keyBasePath: PRIVACY_CASH_CIRCUIT_URL,
      publicKey: this.publicKey,
      storage: localStorage,
      encryptionService: this.encryptionService,
      mintAddress,
      recipient: new PublicKey(recipientAddress),
    });
    return {
      signature: result.tx,
      isPartial: result.isPartial,
      fee: result.fee_base_units / Math.pow(10, tokenInfo.decimals),
    };
  }

  async withdrawForSwap(
    amount: number,
    recipientPubkey: PublicKey,
  ): Promise<{ signature: string; fee: number; netAmount: number }> {
    await this.ensureInitialized();
    const sdk = await loadSDK();
    const lightWasm = await getLightWasm();

    const result = await sdk.withdraw({
      lightWasm,
      connection: this.connection,
      amount_in_lamports: Math.floor(amount * 1e9),
      keyBasePath: PRIVACY_CASH_CIRCUIT_URL,
      publicKey: this.publicKey,
      storage: localStorage,
      encryptionService: this.encryptionService,
      recipient: recipientPubkey,
    });

    const fee = result.fee_in_lamports / 1e9;
    const netAmount =
      (result.amount_in_lamports - result.fee_in_lamports) / 1e9;

    return {
      signature: result.tx,
      fee,
      netAmount,
    };
  }

  async depositFromEphemeral(
    amount: number,
    token: PrivacyCashToken,
    ephemeralKeypair: Keypair,
  ): Promise<{ signature: string }> {
    await this.ensureInitialized();
    const sdk = await loadSDK();
    const lightWasm = await getLightWasm();
    const tokenInfo = PRIVACY_CASH_SUPPORTED_TOKENS[token];

    const transactionSigner = async (
      tx: VersionedTransaction,
    ): Promise<VersionedTransaction> => {
      tx.sign([ephemeralKeypair]);
      return tx;
    };

    if (token === "SOL") {
      const result = await sdk.deposit({
        lightWasm,
        connection: this.connection,
        amount_in_lamports: Math.floor(amount * 1e9),
        keyBasePath: PRIVACY_CASH_CIRCUIT_URL,
        publicKey: this.publicKey,
        signer: ephemeralKeypair.publicKey,
        transactionSigner,
        storage: localStorage,
        encryptionService: this.encryptionService,
      });
      return { signature: result.tx };
    }

    const mintAddress = this.getMintAddress(token);

    const result = await sdk.depositSPL({
      lightWasm,
      connection: this.connection,
      base_units: Math.floor(amount * Math.pow(10, tokenInfo.decimals)),
      keyBasePath: PRIVACY_CASH_CIRCUIT_URL,
      publicKey: this.publicKey,
      signer: ephemeralKeypair.publicKey,
      transactionSigner,
      storage: localStorage,
      encryptionService: this.encryptionService,
      mintAddress,
    });

    return { signature: result.tx };
  }

  getConnection(): Connection {
    return this.connection;
  }

  getPublicKey(): PublicKey {
    return this.publicKey;
  }

  getEncryptionService() {
    return this.encryptionService;
  }

  clearCache(): void {
    const key = `${STORAGE_KEY_UTXO_CACHE_PREFIX}${this.publicKey.toBase58()}`;
    try {
      localStorage.removeItem(key);
    } catch {
      // localStorage may not be available
    }
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}

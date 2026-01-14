export interface MobileWalletSession {
  publicKey: string;
  phantomSession: string;
  sharedSecret: Uint8Array;
  phantomEncryptionPublicKey: Uint8Array;
}

export interface PhantomConnectResponse {
  public_key: string;
  session: string;
}

export interface PhantomSignMessageResponse {
  signature: string;
}

export interface PhantomErrorResponse {
  errorCode: string;
  errorMessage: string;
}

export type PhantomCallbackParams =
  | {
      data: string;
      nonce: string;
      phantom_encryption_public_key: string;
    }
  | {
      errorCode: string;
      errorMessage: string;
    };

export interface EphemeralKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export type MobileConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "signing"
  | "error";

export interface MobileWalletState {
  status: MobileConnectionStatus;
  session: MobileWalletSession | null;
  error: string | null;
}

export const PHANTOM_CLUSTER_MAP = {
  "mainnet-beta": "mainnet-beta",
  mainnet: "mainnet-beta",
  devnet: "devnet",
  testnet: "testnet",
} as const;

export type PhantomCluster = keyof typeof PHANTOM_CLUSTER_MAP;

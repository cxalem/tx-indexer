import bs58 from "bs58";
import type { EphemeralKeypair, MobileWalletSession } from "./types";

const KEYPAIR_STORAGE_KEY = "phantom_dapp_keypair";
const SESSION_STORAGE_KEY = "phantom_wallet_session";
const PENDING_AUTH_KEY = "phantom_pending_auth";

interface StoredKeypair {
  publicKey: string;
  secretKey: string;
}

interface StoredSession {
  publicKey: string;
  phantomSession: string;
  sharedSecret: string;
  phantomEncryptionPublicKey: string;
}

export interface PendingAuth {
  walletAddress: string;
  nonce: string;
  message: string;
}

export function storeKeypair(keypair: EphemeralKeypair): void {
  if (typeof window === "undefined") return;

  const stored: StoredKeypair = {
    publicKey: bs58.encode(keypair.publicKey),
    secretKey: bs58.encode(keypair.secretKey),
  };
  localStorage.setItem(KEYPAIR_STORAGE_KEY, JSON.stringify(stored));
}

export function getStoredKeypair(): EphemeralKeypair | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed: StoredKeypair = JSON.parse(stored);
    return {
      publicKey: bs58.decode(parsed.publicKey),
      secretKey: bs58.decode(parsed.secretKey),
    };
  } catch {
    return null;
  }
}

export function clearStoredKeypair(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYPAIR_STORAGE_KEY);
}

export function storeSession(session: MobileWalletSession): void {
  if (typeof window === "undefined") return;

  const stored: StoredSession = {
    publicKey: session.publicKey,
    phantomSession: session.phantomSession,
    sharedSecret: bs58.encode(session.sharedSecret),
    phantomEncryptionPublicKey: bs58.encode(session.phantomEncryptionPublicKey),
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
}

export function getStoredSession(): MobileWalletSession | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed: StoredSession = JSON.parse(stored);
    return {
      publicKey: parsed.publicKey,
      phantomSession: parsed.phantomSession,
      sharedSecret: bs58.decode(parsed.sharedSecret),
      phantomEncryptionPublicKey: bs58.decode(
        parsed.phantomEncryptionPublicKey,
      ),
    };
  } catch {
    return null;
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function storePendingAuth(auth: PendingAuth): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(auth));
}

export function getPendingAuth(): PendingAuth | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(PENDING_AUTH_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as PendingAuth;
  } catch {
    return null;
  }
}

export function clearPendingAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_AUTH_KEY);
}

export function clearAllMobileWalletData(): void {
  clearStoredKeypair();
  clearStoredSession();
  clearPendingAuth();
}

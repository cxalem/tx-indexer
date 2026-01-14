import nacl from "tweetnacl";
import bs58 from "bs58";
import type {
  EphemeralKeypair,
  PhantomConnectResponse,
  PhantomSignMessageResponse,
  PHANTOM_CLUSTER_MAP,
} from "./types";

const PHANTOM_UNIVERSAL_LINK_BASE = "https://phantom.app/ul/v1";

export function createEphemeralKeypair(): EphemeralKeypair {
  const keypair = nacl.box.keyPair();
  return {
    publicKey: keypair.publicKey,
    secretKey: keypair.secretKey,
  };
}

export function buildPhantomConnectUrl(params: {
  cluster: keyof typeof PHANTOM_CLUSTER_MAP;
  appUrl: string;
  redirectUrl: string;
  encryptionPublicKey: Uint8Array;
}): string {
  const searchParams = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(params.encryptionPublicKey),
    cluster: params.cluster,
    app_url: params.appUrl,
    redirect_link: params.redirectUrl,
  });

  return `${PHANTOM_UNIVERSAL_LINK_BASE}/connect?${searchParams.toString()}`;
}

export function buildPhantomDisconnectUrl(params: {
  redirectUrl: string;
  encryptionPublicKey: Uint8Array;
  session: string;
  sharedSecret: Uint8Array;
}): string {
  const payload = { session: params.session };
  const { nonce, encryptedPayload } = encryptPayload(
    payload,
    params.sharedSecret,
  );

  const searchParams = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(params.encryptionPublicKey),
    nonce: bs58.encode(nonce),
    redirect_link: params.redirectUrl,
    payload: bs58.encode(encryptedPayload),
  });

  return `${PHANTOM_UNIVERSAL_LINK_BASE}/disconnect?${searchParams.toString()}`;
}

export function buildPhantomSignMessageUrl(params: {
  message: Uint8Array;
  redirectUrl: string;
  encryptionPublicKey: Uint8Array;
  session: string;
  sharedSecret: Uint8Array;
}): string {
  const payload = {
    session: params.session,
    message: bs58.encode(params.message),
  };
  const { nonce, encryptedPayload } = encryptPayload(
    payload,
    params.sharedSecret,
  );

  const searchParams = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(params.encryptionPublicKey),
    nonce: bs58.encode(nonce),
    redirect_link: params.redirectUrl,
    payload: bs58.encode(encryptedPayload),
  });

  return `${PHANTOM_UNIVERSAL_LINK_BASE}/signMessage?${searchParams.toString()}`;
}

export function buildPhantomSignTransactionUrl(params: {
  transaction: Uint8Array;
  redirectUrl: string;
  encryptionPublicKey: Uint8Array;
  session: string;
  sharedSecret: Uint8Array;
}): string {
  const payload = {
    session: params.session,
    transaction: bs58.encode(params.transaction),
  };
  const { nonce, encryptedPayload } = encryptPayload(
    payload,
    params.sharedSecret,
  );

  const searchParams = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(params.encryptionPublicKey),
    nonce: bs58.encode(nonce),
    redirect_link: params.redirectUrl,
    payload: bs58.encode(encryptedPayload),
  });

  return `${PHANTOM_UNIVERSAL_LINK_BASE}/signTransaction?${searchParams.toString()}`;
}

export function buildPhantomSignAndSendTransactionUrl(params: {
  transaction: Uint8Array;
  redirectUrl: string;
  encryptionPublicKey: Uint8Array;
  session: string;
  sharedSecret: Uint8Array;
}): string {
  const payload = {
    session: params.session,
    transaction: bs58.encode(params.transaction),
  };
  const { nonce, encryptedPayload } = encryptPayload(
    payload,
    params.sharedSecret,
  );

  const searchParams = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(params.encryptionPublicKey),
    nonce: bs58.encode(nonce),
    redirect_link: params.redirectUrl,
    payload: bs58.encode(encryptedPayload),
  });

  return `${PHANTOM_UNIVERSAL_LINK_BASE}/signAndSendTransaction?${searchParams.toString()}`;
}

export function buildPhantomBrowseUrl(targetUrl: string): string {
  const encodedUrl = encodeURIComponent(targetUrl);
  return `${PHANTOM_UNIVERSAL_LINK_BASE}/browse/${encodedUrl}?ref=${encodedUrl}`;
}

export function deriveSharedSecret(
  phantomEncryptionPublicKey: Uint8Array,
  dappSecretKey: Uint8Array,
): Uint8Array {
  return nacl.box.before(phantomEncryptionPublicKey, dappSecretKey);
}

export function decryptConnectResponse(
  data: string,
  nonce: string,
  sharedSecret: Uint8Array,
): PhantomConnectResponse {
  const decrypted = decryptPayload(data, nonce, sharedSecret);
  return decrypted as PhantomConnectResponse;
}

export function decryptSignMessageResponse(
  data: string,
  nonce: string,
  sharedSecret: Uint8Array,
): PhantomSignMessageResponse {
  const decrypted = decryptPayload(data, nonce, sharedSecret);
  return decrypted as PhantomSignMessageResponse;
}

export function decryptSignTransactionResponse(
  data: string,
  nonce: string,
  sharedSecret: Uint8Array,
): { signature: string } {
  const decrypted = decryptPayload(data, nonce, sharedSecret);
  return decrypted as { signature: string };
}

function encryptPayload(
  payload: Record<string, string>,
  sharedSecret: Uint8Array,
): { nonce: Uint8Array; encryptedPayload: Uint8Array } {
  const nonce = nacl.randomBytes(24);
  const message = new TextEncoder().encode(JSON.stringify(payload));
  const encryptedPayload = nacl.box.after(message, nonce, sharedSecret);
  return { nonce, encryptedPayload };
}

function decryptPayload(
  data: string,
  nonce: string,
  sharedSecret: Uint8Array,
): unknown {
  const decodedData = bs58.decode(data);
  const decodedNonce = bs58.decode(nonce);
  const decrypted = nacl.box.open.after(
    decodedData,
    decodedNonce,
    sharedSecret,
  );

  if (!decrypted) {
    throw new Error("Failed to decrypt payload");
  }

  const decoded = new TextDecoder().decode(decrypted);
  return JSON.parse(decoded);
}

export function isPhantomErrorResponse(params: URLSearchParams): boolean {
  return params.has("errorCode");
}

export function parsePhantomError(params: URLSearchParams): {
  code: string;
  message: string;
} {
  return {
    code: params.get("errorCode") ?? "unknown",
    message: params.get("errorMessage") ?? "Unknown error",
  };
}

export function parsePhantomConnectCallback(
  params: URLSearchParams,
  dappSecretKey: Uint8Array,
): {
  publicKey: string;
  session: string;
  sharedSecret: Uint8Array;
  phantomEncryptionPublicKey: Uint8Array;
} {
  const data = params.get("data");
  const nonce = params.get("nonce");
  const phantomEncryptionPublicKeyStr = params.get(
    "phantom_encryption_public_key",
  );

  if (!data || !nonce || !phantomEncryptionPublicKeyStr) {
    throw new Error("Missing required parameters in callback");
  }

  const phantomEncryptionPublicKey = bs58.decode(phantomEncryptionPublicKeyStr);
  const sharedSecret = deriveSharedSecret(
    phantomEncryptionPublicKey,
    dappSecretKey,
  );
  const response = decryptConnectResponse(data, nonce, sharedSecret);

  return {
    publicKey: response.public_key,
    session: response.session,
    sharedSecret,
    phantomEncryptionPublicKey,
  };
}

export function parsePhantomSignMessageCallback(
  params: URLSearchParams,
  sharedSecret: Uint8Array,
): Uint8Array {
  const data = params.get("data");
  const nonce = params.get("nonce");

  if (!data || !nonce) {
    throw new Error("Missing required parameters in sign message callback");
  }

  const response = decryptSignMessageResponse(data, nonce, sharedSecret);
  return bs58.decode(response.signature);
}

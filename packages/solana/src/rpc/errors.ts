/**
 * Fetch-level error types and helpers shared by the transaction fetchers.
 *
 * The SDK maps these onto its public TxIndexerError hierarchy
 * (see packages/sdk/src/errors.ts).
 */

/** JSON-RPC server error code for "Transaction version (N) is not supported". */
export const UNSUPPORTED_TRANSACTION_VERSION_RPC_CODE = -32015;

/**
 * Highest transaction version this package requests from the RPC.
 * Version 1 (live on mainnet since 2026-09-15) is read; anything newer is
 * refused by the RPC with -32015 and surfaces as
 * UnsupportedTransactionVersionError.
 */
export const MAX_SUPPORTED_TRANSACTION_VERSION = 1;

const UNSUPPORTED_VERSION_MESSAGE =
  /transaction version \(?\d+\)? is not supported/i;

/**
 * Detects an RPC rejection caused by a transaction whose version is higher
 * than the requested `maxSupportedTransactionVersion`.
 *
 * Recognizes:
 * - @solana/kit `SolanaError` with `context.__code === -32015`
 * - raw JSON-RPC error objects (`{ code: -32015, message }`)
 * - plain errors carrying the server message text
 */
export function isUnsupportedTransactionVersionRpcError(
  error: unknown,
): boolean {
  if (error instanceof UnsupportedTransactionVersionError) return true;
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    context?: { __code?: unknown; __serverMessage?: unknown } | null;
  };

  if (candidate.code === UNSUPPORTED_TRANSACTION_VERSION_RPC_CODE) return true;
  if (candidate.context?.__code === UNSUPPORTED_TRANSACTION_VERSION_RPC_CODE) {
    return true;
  }
  if (
    typeof candidate.message === "string" &&
    UNSUPPORTED_VERSION_MESSAGE.test(candidate.message)
  ) {
    return true;
  }
  if (
    typeof candidate.context?.__serverMessage === "string" &&
    UNSUPPORTED_VERSION_MESSAGE.test(candidate.context.__serverMessage)
  ) {
    return true;
  }
  return false;
}

function extractTransactionVersion(error: unknown): number | undefined {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  const match = message.match(/transaction version \(?(\d+)\)?/i);
  return match?.[1] !== undefined ? Number(match[1]) : undefined;
}

/**
 * Thrown when the RPC refuses to return a transaction because its version is
 * newer than this package supports (`maxSupportedTransactionVersion: 1`).
 *
 * Not retryable: asking again with the same parameters will fail again.
 */
export class UnsupportedTransactionVersionError extends Error {
  readonly code = "UNSUPPORTED_TRANSACTION_VERSION" as const;
  readonly retryable = false;
  readonly signature: string;
  /** Version reported by the RPC, when it could be parsed from the message */
  readonly transactionVersion?: number;
  readonly maxSupportedTransactionVersion = MAX_SUPPORTED_TRANSACTION_VERSION;
  override readonly cause?: unknown;

  constructor(signature: string, options?: { cause?: unknown }) {
    const version = extractTransactionVersion(options?.cause);
    super(
      `Transaction ${signature} uses version ${version ?? "unknown"}, which is ` +
        `newer than the supported maxSupportedTransactionVersion ` +
        `(${MAX_SUPPORTED_TRANSACTION_VERSION}). It was not fetched.`,
    );
    Object.defineProperty(this, "name", {
      value: "UnsupportedTransactionVersionError",
      enumerable: false,
    });
    this.signature = signature;
    this.transactionVersion = version;
    this.cause = options?.cause;
  }
}

/** Why a signature did not produce a transaction in a batch fetch. */
export type TransactionSkipReason =
  | "not_found"
  | "unsupported_version"
  | "fetch_failed";

/** A signature that was requested but not returned, and why. */
export interface SkippedTransaction {
  signature: string;
  reason: TransactionSkipReason;
  /** Present for "unsupported_version" and "fetch_failed" */
  error?: Error;
}

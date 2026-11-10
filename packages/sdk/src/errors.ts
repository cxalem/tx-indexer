/**
 * Custom error types for the tx-indexer SDK.
 *
 * @module tx-indexer/errors
 */

/**
 * Base class for all tx-indexer errors.
 * Extends the built-in Error with additional context.
 */
export class TxIndexerError extends Error {
  /** Error code for programmatic handling */
  readonly code: string;

  /** Whether this error is retryable */
  readonly retryable: boolean;

  /** Original error that caused this error, if any */
  override readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    name: string = "TxIndexerError",
    options?: { retryable?: boolean; cause?: Error },
  ) {
    super(message);
    Object.defineProperty(this, "name", { value: name, enumerable: false });
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.cause = options?.cause;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when RPC rate limits are hit.
 *
 * @example
 * ```typescript
 * try {
 *   await indexer.getTransactions(wallet);
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     console.log(`Rate limited. Retry after ${error.retryAfterMs}ms`);
 *   }
 * }
 * ```
 */
export class RateLimitError extends TxIndexerError {
  /** Suggested delay before retrying, in milliseconds */
  readonly retryAfterMs: number;

  constructor(
    message?: string,
    options?: { retryAfterMs?: number; cause?: Error },
  ) {
    super(
      message ?? "Rate limit exceeded. Please slow down requests.",
      "RATE_LIMIT",
      "RateLimitError",
      { retryable: true, cause: options?.cause },
    );
    this.retryAfterMs = options?.retryAfterMs ?? 1000;
  }
}

/**
 * Error thrown when an RPC call fails.
 */
export class RpcError extends TxIndexerError {
  /** HTTP status code, if available */
  readonly statusCode?: number;

  /** RPC method that failed */
  readonly method?: string;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      method?: string;
      retryable?: boolean;
      cause?: Error;
    },
  ) {
    super(message, "RPC_ERROR", "RpcError", {
      retryable: options?.retryable ?? false,
      cause: options?.cause,
    });
    this.statusCode = options?.statusCode;
    this.method = options?.method;
  }
}

/**
 * Error thrown when the network is unavailable or times out.
 */
export class NetworkError extends TxIndexerError {
  constructor(message?: string, options?: { cause?: Error }) {
    super(
      message ?? "Network request failed. Check your connection.",
      "NETWORK_ERROR",
      "NetworkError",
      { retryable: true, cause: options?.cause },
    );
  }
}

/**
 * Error thrown when input validation fails.
 *
 * @example
 * ```typescript
 * try {
 *   await indexer.getTransaction("invalid-signature");
 * } catch (error) {
 *   if (error instanceof InvalidInputError) {
 *     console.log(`Invalid input: ${error.field} - ${error.message}`);
 *   }
 * }
 * ```
 */
export class InvalidInputError extends TxIndexerError {
  /** The field that failed validation */
  readonly field?: string;

  /** The invalid value that was provided */
  readonly value?: unknown;

  constructor(
    message: string,
    options?: { field?: string; value?: unknown; cause?: Error },
  ) {
    super(message, "INVALID_INPUT", "InvalidInputError", {
      retryable: false,
      cause: options?.cause,
    });
    this.field = options?.field;
    this.value = options?.value;
  }
}

/**
 * Error thrown when a required configuration is missing.
 */
export class ConfigurationError extends TxIndexerError {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, "CONFIGURATION_ERROR", "ConfigurationError", {
      retryable: false,
      cause: options?.cause,
    });
  }
}

/**
 * Error thrown when an NFT metadata fetch fails.
 * This typically means the RPC doesn't support DAS (Digital Asset Standard).
 */
export class NftMetadataError extends TxIndexerError {
  /** The mint address that failed */
  readonly mintAddress?: string;

  constructor(
    message: string,
    options?: { mintAddress?: string; retryable?: boolean; cause?: Error },
  ) {
    super(message, "NFT_METADATA_ERROR", "NftMetadataError", {
      retryable: options?.retryable ?? false,
      cause: options?.cause,
    });
    this.mintAddress = options?.mintAddress;
  }
}

/**
 * Error thrown when the RPC refuses to return a transaction because its
 * version is newer than this SDK requests (`maxSupportedTransactionVersion: 0`).
 *
 * Version 1 transactions have been live on mainnet since 2026-09-15; until the
 * SDK supports them, they surface as this error (single fetch) or as a skipped
 * signature with reason "unsupported_version" (history fetches). Not retryable.
 *
 * @example
 * ```typescript
 * try {
 *   await indexer.getTransaction(signature);
 * } catch (error) {
 *   if (error instanceof UnsupportedTransactionVersionError) {
 *     console.log(`Cannot read ${error.signature} yet (v${error.transactionVersion})`);
 *   }
 * }
 * ```
 */
export class UnsupportedTransactionVersionError extends TxIndexerError {
  /** Signature of the transaction that could not be fetched */
  readonly signature: string;

  /** Version reported by the RPC, when it could be determined */
  readonly transactionVersion?: number;

  /** Highest transaction version this SDK requests */
  readonly maxSupportedTransactionVersion: number;

  constructor(
    signature: string,
    options?: {
      transactionVersion?: number;
      maxSupportedTransactionVersion?: number;
      message?: string;
      cause?: Error;
    },
  ) {
    const max = options?.maxSupportedTransactionVersion ?? 0;
    super(
      options?.message ??
        `Transaction ${signature} uses version ${
          options?.transactionVersion ?? "unknown"
        }, which is newer than the supported maxSupportedTransactionVersion (${max}).`,
      "UNSUPPORTED_TRANSACTION_VERSION",
      "UnsupportedTransactionVersionError",
      { retryable: false, cause: options?.cause },
    );
    this.signature = signature;
    this.transactionVersion = options?.transactionVersion;
    this.maxSupportedTransactionVersion = max;
  }
}

/**
 * Type guard to check if an error is a TxIndexerError.
 */
export function isTxIndexerError(error: unknown): error is TxIndexerError {
  return error instanceof TxIndexerError;
}

/**
 * Type guard to check if an error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TxIndexerError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for common retryable patterns
    return (
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("socket hang up") ||
      message.includes("network") ||
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("503") ||
      message.includes("502") ||
      message.includes("504")
    );
  }

  return false;
}

/**
 * Wraps an unknown error into a TxIndexerError.
 * Useful for normalizing errors from external sources.
 */
export function wrapError(error: unknown, context?: string): TxIndexerError {
  if (error instanceof TxIndexerError) {
    return error;
  }

  // Fetch-layer unsupported-version error (packages/solana/src/rpc/errors.ts)
  if (
    error instanceof Error &&
    (error as { code?: unknown }).code === "UNSUPPORTED_TRANSACTION_VERSION"
  ) {
    const fetchError = error as Error & {
      signature?: string;
      transactionVersion?: number;
      maxSupportedTransactionVersion?: number;
    };
    return new UnsupportedTransactionVersionError(
      fetchError.signature ?? "unknown",
      {
        transactionVersion: fetchError.transactionVersion,
        maxSupportedTransactionVersion:
          fetchError.maxSupportedTransactionVersion,
        message: context ? `${context}: ${error.message}` : error.message,
        cause: error,
      },
    );
  }

  const cause = error instanceof Error ? error : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const fullMessage = context ? `${context}: ${message}` : message;

  // Detect specific error types from the message
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("429") ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("too many requests")
  ) {
    return new RateLimitError(fullMessage, { cause });
  }

  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("econnreset") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("network")
  ) {
    return new NetworkError(fullMessage, { cause });
  }

  if (
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("expected") ||
    lowerMessage.includes("must be")
  ) {
    return new InvalidInputError(fullMessage, { cause });
  }

  // Default to RpcError for unknown errors
  return new RpcError(fullMessage, {
    cause,
    retryable: isRetryableError(error),
  });
}

/**
 * JSON-safe types for serialization over the wire (e.g., Next.js route handlers, server actions).
 *
 * These types replace non-JSON-safe values:
 * - `bigint` -> `string`
 * - `Date` -> ISO 8601 string
 *
 * @example
 * ```ts
 * // In a Next.js API route:
 * import { toJsonClassifiedTransaction } from '@tx-indexer/sdk';
 *
 * export async function GET() {
 *   const tx = await indexer.getTransaction(signature);
 *   return Response.json(toJsonClassifiedTransaction(tx));
 * }
 * ```
 */

import type { ClassifiedTransaction } from "./client";
import type {
  RawTransaction,
  TxLeg,
  TokenBalance,
  TxLegSide,
  TxLegRole,
  TxPrimaryType,
} from "@tx-indexer/core/tx/tx.types";
import type {
  TokenInfo,
  FiatValue,
  MoneyAmount,
} from "@tx-indexer/core/money/money.types";
import type {
  Counterparty,
  ProtocolInfo,
} from "@tx-indexer/core/actors/counterparty.types";

// =============================================================================
// JSON-Safe Token & Money Types
// =============================================================================

/**
 * JSON-safe version of TokenInfo.
 * Same as TokenInfo since all fields are already JSON-safe.
 */
export type JsonTokenInfo = TokenInfo;

/**
 * JSON-safe version of FiatValue where `at` is an ISO 8601 string instead of Date.
 */
export interface JsonFiatValue {
  currency: "USD" | "EUR";
  amount: number;
  pricePerUnit: number;
  source?: string;
  /** ISO 8601 timestamp string (e.g., "2024-01-15T10:30:00.000Z") */
  at: string;
}

/**
 * JSON-safe version of MoneyAmount where fiat.at is a string.
 */
export interface JsonMoneyAmount {
  token: JsonTokenInfo;
  amountRaw: string;
  amountUi: number;
  fiat?: JsonFiatValue;
}

// =============================================================================
// JSON-Safe Transaction Types
// =============================================================================

/**
 * JSON-safe version of TokenBalance.
 * Same as TokenBalance since all fields are already JSON-safe.
 */
export type JsonTokenBalance = TokenBalance;

/**
 * JSON-safe version of ProtocolInfo.
 * Same as ProtocolInfo since all fields are already JSON-safe.
 */
export type JsonProtocolInfo = ProtocolInfo;

/**
 * JSON-safe version of RawTransaction where bigint fields are strings.
 */
export interface JsonRawTransaction {
  signature: string;
  /** String representation of the slot (originally bigint | number) */
  slot: string;
  /** String representation of the block time or null (originally bigint | number | null) */
  blockTime: string | null;
  fee?: number;
  err: unknown;
  programIds: string[];
  protocol: JsonProtocolInfo | null;
  preTokenBalances?: JsonTokenBalance[];
  postTokenBalances?: JsonTokenBalance[];
  /** String representations of lamport balances (originally bigint | number) */
  preBalances?: string[];
  /** String representations of lamport balances (originally bigint | number) */
  postBalances?: string[];
  accountKeys?: string[];
  memo?: string | null;
}

// =============================================================================
// JSON-Safe Classification Types
// =============================================================================

/**
 * JSON-safe version of Counterparty.
 * Same as Counterparty since all fields are already JSON-safe.
 *
 * @note The counterparty field is best-effort display information based on
 * known protocol addresses. Do not rely on this for security-critical decisions.
 */
export type JsonCounterparty = Counterparty;

/**
 * JSON-safe version of TransactionClassification.
 */
export interface JsonTransactionClassification {
  primaryType: TxPrimaryType;
  primaryAmount: JsonMoneyAmount | null;
  secondaryAmount?: JsonMoneyAmount | null;
  sender?: string | null;
  receiver?: string | null;
  /**
   * Best-effort counterparty information based on known protocol addresses.
   * This is for display purposes only and may not always be accurate.
   * Do not rely on this for security-critical decisions.
   */
  counterparty: JsonCounterparty | null;
  confidence: number;
  isRelevant?: boolean;
  metadata?: Record<string, unknown>;
  debugTrace?: {
    selectedClassifier: string | null;
    selectedType: TxPrimaryType | null;
    walletAddress?: string | null;
    decisions: Array<{
      classifier: string;
      priority: number;
      matched: boolean;
      relevant: boolean;
      reason: string;
      elapsedMs?: number;
    }>;
  };
}

// =============================================================================
// JSON-Safe Leg Types
// =============================================================================

/**
 * JSON-safe version of TxLeg.
 */
export interface JsonTxLeg {
  accountId: string;
  side: TxLegSide;
  amount: JsonMoneyAmount;
  role: TxLegRole;
}

// =============================================================================
// JSON-Safe Classified Transaction
// =============================================================================

/**
 * JSON-safe version of ClassifiedTransaction for serialization.
 *
 * Use this type when returning transactions from API routes or server actions
 * where the data will be serialized to JSON.
 */
export interface JsonClassifiedTransaction {
  tx: JsonRawTransaction;
  classification: JsonTransactionClassification;
  legs: JsonTxLeg[];
}

// =============================================================================
// Conversion Helpers
// =============================================================================

/**
 * Converts a FiatValue to its JSON-safe representation.
 */
function toJsonFiatValue(fiat: FiatValue): JsonFiatValue {
  return {
    currency: fiat.currency,
    amount: fiat.amount,
    pricePerUnit: fiat.pricePerUnit,
    source: fiat.source,
    at: fiat.at.toISOString(),
  };
}

/**
 * Converts a MoneyAmount to its JSON-safe representation.
 */
function toJsonMoneyAmount(amount: MoneyAmount): JsonMoneyAmount {
  return {
    token: amount.token,
    amountRaw: amount.amountRaw,
    amountUi: amount.amountUi,
    fiat: amount.fiat ? toJsonFiatValue(amount.fiat) : undefined,
  };
}

/**
 * Converts a bigint or number to a string for JSON serialization.
 */
function toJsonBigInt(value: bigint | number): string {
  return value.toString();
}

/**
 * Converts a RawTransaction to its JSON-safe representation.
 */
function toJsonRawTransaction(tx: RawTransaction): JsonRawTransaction {
  return {
    signature: tx.signature,
    slot: toJsonBigInt(tx.slot),
    blockTime: tx.blockTime !== null ? toJsonBigInt(tx.blockTime) : null,
    fee: tx.fee,
    err: tx.err,
    programIds: tx.programIds,
    protocol: tx.protocol,
    preTokenBalances: tx.preTokenBalances,
    postTokenBalances: tx.postTokenBalances,
    preBalances: tx.preBalances?.map(toJsonBigInt),
    postBalances: tx.postBalances?.map(toJsonBigInt),
    accountKeys: tx.accountKeys,
    memo: tx.memo,
  };
}

/**
 * Converts a TxLeg to its JSON-safe representation.
 */
function toJsonTxLeg(leg: TxLeg): JsonTxLeg {
  return {
    accountId: leg.accountId,
    side: leg.side,
    amount: toJsonMoneyAmount(leg.amount),
    role: leg.role,
  };
}

/**
 * Converts a TransactionClassification to its JSON-safe representation.
 */
function toJsonTransactionClassification(
  classification: ClassifiedTransaction["classification"],
): JsonTransactionClassification {
  return {
    primaryType: classification.primaryType,
    primaryAmount: classification.primaryAmount
      ? toJsonMoneyAmount(classification.primaryAmount)
      : null,
    secondaryAmount: classification.secondaryAmount
      ? toJsonMoneyAmount(classification.secondaryAmount)
      : undefined,
    sender: classification.sender,
    receiver: classification.receiver,
    counterparty: classification.counterparty,
    confidence: classification.confidence,
    isRelevant: classification.isRelevant,
    metadata: classification.metadata,
    debugTrace: classification.debugTrace,
  };
}

/**
 * Converts a ClassifiedTransaction to its JSON-safe representation.
 *
 * Use this when you need to serialize a transaction for:
 * - Next.js API routes (Response.json())
 * - Next.js server actions
 * - Any HTTP response that will be JSON.stringify'd
 *
 * @example
 * ```ts
 * // Next.js API route
 * import { createIndexer, toJsonClassifiedTransaction } from '@tx-indexer/sdk';
 *
 * export async function GET(request: Request) {
 *   const indexer = createIndexer({ rpcUrl: process.env.RPC_URL });
 *   const tx = await indexer.getTransaction(signature);
 *   if (!tx) return new Response('Not found', { status: 404 });
 *   return Response.json(toJsonClassifiedTransaction(tx));
 * }
 * ```
 *
 * @example
 * ```ts
 * // Next.js server action
 * 'use server';
 * import { createIndexer, toJsonClassifiedTransactions } from '@tx-indexer/sdk';
 *
 * export async function getWalletTransactions(wallet: string) {
 *   const indexer = createIndexer({ rpcUrl: process.env.RPC_URL });
 *   const txs = await indexer.getTransactions(wallet);
 *   return toJsonClassifiedTransactions(txs);
 * }
 * ```
 */
export function toJsonClassifiedTransaction(
  tx: ClassifiedTransaction,
): JsonClassifiedTransaction {
  return {
    tx: toJsonRawTransaction(tx.tx),
    classification: toJsonTransactionClassification(tx.classification),
    legs: tx.legs.map(toJsonTxLeg),
  };
}

/**
 * Converts an array of ClassifiedTransactions to their JSON-safe representations.
 *
 * @see {@link toJsonClassifiedTransaction} for usage examples
 */
export function toJsonClassifiedTransactions(
  txs: ClassifiedTransaction[],
): JsonClassifiedTransaction[] {
  return txs.map(toJsonClassifiedTransaction);
}

import { Hono } from "hono";
import { z } from "zod";
import type { Bindings } from "../types";
import { success, error } from "../lib/response";
import {
  createSolanaClient,
  parseAddress,
  parseSignature,
} from "@tx-indexer/solana/rpc/client";
import {
  fetchWalletSignatures,
  fetchTransactionsBatch,
} from "@tx-indexer/solana/fetcher/transactions";
import { transactionToLegs } from "@tx-indexer/solana/mappers/transaction-to-legs";
import { classifyTransaction } from "@tx-indexer/classification/engine/classification-service";
import { detectProtocol } from "@tx-indexer/classification/protocols/detector";
import { filterSpamTransactions } from "@tx-indexer/core/tx/spam-filter";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";

/**
 * Derives the direction of a transaction from the wallet's perspective.
 * - "in": wallet receives value (transfers in, swaps where they get tokens, airdrops)
 * - "out": wallet sends value (transfers out, swaps where they spend tokens)
 * - "self": internal transaction (swaps, stake operations on own account)
 * - null: cannot determine direction
 */
function deriveDirection(
  classification: TransactionClassification,
  walletAddress: string,
): "in" | "out" | "self" | null {
  const { primaryType, sender, receiver } = classification;
  const walletLower = walletAddress.toLowerCase();
  const senderLower = sender?.toLowerCase();
  const receiverLower = receiver?.toLowerCase();

  // Swaps are always "self" - you're exchanging tokens with yourself
  if (primaryType === "swap") {
    return "self";
  }

  // Stake operations are "self"
  if (primaryType === "stake_deposit" || primaryType === "stake_withdraw") {
    return "self";
  }

  // Airdrops and rewards are always "in"
  if (primaryType === "airdrop" || primaryType === "reward") {
    return "in";
  }

  // For transfers, check sender/receiver
  if (senderLower === walletLower && receiverLower === walletLower) {
    return "self";
  }
  if (senderLower === walletLower) {
    return "out";
  }
  if (receiverLower === walletLower) {
    return "in";
  }

  return null;
}

const transactions = new Hono<{ Bindings: Bindings }>();

const AddressSchema = z.string().min(32).max(44);

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  before: z.string().optional(),
  format: z.enum(["raw", "classified"]).optional().default("classified"),
});

/**
 * Get wallet transaction history
 *
 * @route GET /wallet/:address/transactions
 * @param {string} address - Solana wallet address
 * @query {number} limit - Number of transactions to return (1-100, default: 10)
 * @query {string} before - Transaction signature to paginate before (cursor)
 * @returns {Object} Classified transaction history with pagination
 *
 * @example
 * Request:
 * GET /api/v1/wallet/Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9/transactions?limit=5
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "wallet": "Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9",
 *     "transactions": [
 *       {
 *         "signature": "5x...",
 *         "blockTime": 1702345678,
 *         "status": "success",
 *         "type": "transfer",
 *         "direction": "outgoing",
 *         "primaryAmount": {
 *           "token": "USDC",
 *           "amount": 100.5,
 *           "decimals": 6
 *         },
 *         "counterparty": {
 *           "name": "Unknown",
 *           "address": "Abc..."
 *         },
 *         "fee": 0.000005,
 *         "memo": "Payment for services"
 *       }
 *     ],
 *     "pagination": {
 *       "limit": 5,
 *       "count": 5,
 *       "hasMore": true,
 *       "nextCursor": "5x..."
 *     }
 *   },
 *   "meta": {
 *     "timestamp": "2025-12-09T...",
 *     "version": "1.0.0"
 *   }
 * }
 *
 * @throws {400} Invalid wallet address or query parameters
 * @throws {503} RPC connection failed
 */
transactions.get("/:address/transactions", async (c) => {
  try {
    const rawAddress = c.req.param("address");
    const validAddress = AddressSchema.parse(rawAddress);
    const query = QuerySchema.parse(c.req.query());

    const cacheKey = `txs:${validAddress}:${query.limit}:${query.before || "latest"}:${query.format}`;
    const cached = await c.env.CACHE.get(cacheKey);

    if (cached) {
      return c.json(JSON.parse(cached));
    }

    const client = createSolanaClient(c.env.RPC_URL);
    const address = parseAddress(validAddress);

    const signatures = await fetchWalletSignatures(client.rpc, address, {
      limit: query.limit,
      before: query.before ? parseSignature(query.before) : undefined,
    });

    if (signatures.length === 0) {
      const emptyResponse = success({
        wallet: validAddress,
        transactions: [],
        pagination: {
          limit: query.limit,
          count: 0,
          hasMore: false,
        },
      });
      return c.json(emptyResponse);
    }

    const rawTransactions = await fetchTransactionsBatch(
      client.rpc,
      signatures.map((s) => s.signature),
    );

    if (query.format === "raw") {
      const formattedTxs = rawTransactions.map((tx) => ({
        signature: tx.signature,
        blockTime: tx.blockTime ? Number(tx.blockTime) : null,
        slot: tx.slot ? Number(tx.slot) : null,
        status: tx.err ? "failed" : "success",
        transaction: {
          ...tx,
          slot: Number(tx.slot),
          blockTime: tx.blockTime ? Number(tx.blockTime) : null,
          preBalances: tx.preBalances?.map((b) => Number(b)),
          postBalances: tx.postBalances?.map((b) => Number(b)),
        },
      }));

      const hasMore = signatures.length === query.limit;
      const nextCursor =
        hasMore && signatures.length > 0
          ? signatures[signatures.length - 1]?.signature
          : undefined;

      const response = success({
        wallet: validAddress,
        transactions: formattedTxs,
        pagination: {
          limit: query.limit,
          count: formattedTxs.length,
          hasMore,
          ...(nextCursor && { nextCursor }),
        },
      });

      await c.env.CACHE.put(cacheKey, JSON.stringify(response), {
        expirationTtl: 60,
      });

      return c.json(response);
    }

    const classifiedTransactions = rawTransactions.map((tx) => {
      tx.protocol = detectProtocol(tx.programIds);
      const legs = transactionToLegs(tx, validAddress);
      const classification = classifyTransaction(legs, tx, validAddress);
      return { tx, classification, legs };
    });

    const filtered = filterSpamTransactions(classifiedTransactions, {
      minSolAmount: 0.001,
      minTokenAmountUsd: 0.01,
      minConfidence: 0.5,
      allowFailed: false,
    });

    const formattedTxs = filtered.map(({ tx, classification, legs }) => {
      const feeLegs = legs.filter((leg) => leg.role === "fee");
      const totalFee = feeLegs.reduce(
        (sum, leg) => sum + Math.abs(leg.amount.amountUi),
        0,
      );

      return {
        signature: tx.signature,
        blockTime: tx.blockTime ? Number(tx.blockTime) : null,
        status: tx.err ? "failed" : "success",
        type: classification.primaryType,
        direction: deriveDirection(classification, validAddress),
        primaryAmount: classification.primaryAmount
          ? {
              token: classification.primaryAmount.token.symbol,
              amount: classification.primaryAmount.amountUi,
              decimals: classification.primaryAmount.token.decimals,
            }
          : null,
        counterparty: classification.counterparty
          ? {
              name: classification.counterparty.name || "Unknown",
              address: classification.counterparty.address,
            }
          : null,
        fee: totalFee,
        memo: classification.metadata?.memo || null,
        facilitator: classification.metadata?.facilitator || null,
      };
    });

    const hasMore = signatures.length === query.limit;
    const nextCursor =
      hasMore && signatures.length > 0
        ? signatures[signatures.length - 1]?.signature
        : undefined;

    const response = success({
      wallet: validAddress,
      transactions: formattedTxs,
      pagination: {
        limit: query.limit,
        count: formattedTxs.length,
        hasMore,
        ...(nextCursor && { nextCursor }),
      },
    });

    await c.env.CACHE.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 60,
    });

    return c.json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(
        error(
          "VALIDATION_ERROR",
          `Invalid parameters: ${err.issues.map((e: any) => e.message).join(", ")}`,
        ),
        400,
      );
    }

    if (err instanceof Error && err.message.includes("Invalid address")) {
      return c.json(error("INVALID_ADDRESS", err.message), 400);
    }

    return c.json(
      error(
        "FETCH_FAILED",
        err instanceof Error ? err.message : "Failed to fetch transactions",
      ),
      503,
    );
  }
});

export default transactions;

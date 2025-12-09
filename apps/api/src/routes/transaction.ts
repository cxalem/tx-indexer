import { Hono } from "hono";
import { z } from "zod";
import type { Bindings } from "../types";
import { success, error } from "../lib/response";
import { createSolanaClient, parseSignature } from "@solana/rpc/client";
import { fetchTransaction } from "@solana/fetcher/transactions";
import { transactionToLegs } from "@solana/mappers/transaction-to-legs";
import { classifyTransaction } from "@classification/engine/classification-service";
import { detectProtocol } from "@classification/protocols/detector";
import { validateLegsBalance } from "@domain/tx/leg-validation";

const transaction = new Hono<{ Bindings: Bindings }>();

const SignatureSchema = z.string().length(88);

/**
 * Get single transaction by signature
 * 
 * @route GET /transaction/:signature
 * @param {string} signature - Transaction signature (base58, 88 characters)
 * @returns {Object} Detailed transaction classification and accounting legs
 * 
 * @example
 * Request:
 * GET /api/v1/transaction/5x...ABC
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "signature": "5x...ABC",
 *     "blockTime": 1702345678,
 *     "slot": 123456789,
 *     "status": "success",
 *     "classification": {
 *       "type": "transfer",
 *       "direction": "outgoing",
 *       "primaryAmount": {
 *         "token": "USDC",
 *         "amount": 100.5,
 *         "decimals": 6
 *       },
 *       "counterparty": {
 *         "name": "Unknown",
 *         "address": "Abc..."
 *       },
 *       "confidence": 0.95,
 *       "memo": "Payment for services"
 *     },
 *     "accounting": {
 *       "legs": [
 *         {
 *           "accountId": "wallet:Hb6d...",
 *           "side": "debit",
 *           "amount": {
 *             "token": "USDC",
 *             "amountUi": 100.5,
 *             "decimals": 6
 *           },
 *           "role": "sent"
 *         }
 *       ],
 *       "balanced": true
 *     },
 *     "protocol": {
 *       "id": "system",
 *       "name": "System Program"
 *     },
 *     "fee": 0.000005
 *   },
 *   "meta": {
 *     "timestamp": "2025-12-09T...",
 *     "version": "1.0.0"
 *   }
 * }
 * 
 * @throws {400} Invalid signature format
 * @throws {404} Transaction not found
 * @throws {503} RPC connection failed
 */
transaction.get("/:signature", async (c) => {
  try {
    const rawSignature = c.req.param("signature");
    const validSignature = SignatureSchema.parse(rawSignature);

    const cacheKey = `tx:${validSignature}`;
    const cached = await c.env.CACHE.get(cacheKey);
    
    if (cached) {
      return c.json(JSON.parse(cached));
    }

    const client = createSolanaClient(c.env.RPC_URL);
    const signature = parseSignature(validSignature);

    const tx = await fetchTransaction(client.rpc, signature);

    if (!tx) {
      return c.json(error("NOT_FOUND", "Transaction not found"), 404);
    }

    tx.protocol = detectProtocol(tx.programIds);
    const legs = transactionToLegs(tx, tx.accountKeys?.[0] || "");
    const classification = classifyTransaction(legs, tx.accountKeys?.[0] || "", tx);
    const validation = validateLegsBalance(legs);

    const feeLegs = legs.filter((leg) => leg.role === "fee");
    const totalFee = feeLegs.reduce((sum, leg) => sum + Math.abs(leg.amount.amountUi), 0);

    const response = success({
      signature: validSignature,
      blockTime: tx.blockTime ? Number(tx.blockTime) : null,
      slot: tx.slot ? Number(tx.slot) : null,
      status: tx.err ? "failed" : "success",
      classification: {
        type: classification.primaryType,
        direction: classification.direction,
        primaryAmount: classification.primaryAmount
          ? {
              token: classification.primaryAmount.token,
              amount: classification.primaryAmount.amount,
              decimals: classification.primaryAmount.decimals,
            }
          : null,
        counterparty: classification.counterparty
          ? {
              name: classification.counterparty.name || "Unknown",
              address: classification.counterparty.address,
            }
          : null,
        confidence: classification.confidence,
        memo: classification.metadata?.memo || null,
      },
      accounting: {
        legs: legs.map((leg) => ({
          accountId: leg.accountId,
          side: leg.side,
          amount: {
            token: leg.amount.token.symbol,
            amountUi: leg.amount.amountUi,
            decimals: leg.amount.token.decimals,
          },
          role: leg.role,
        })),
        balanced: validation.isBalanced,
      },
      protocol: tx.protocol
        ? {
            id: tx.protocol.id,
            name: tx.protocol.name,
          }
        : null,
      fee: totalFee,
    });

    await c.env.CACHE.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 300,
    });

    return c.json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(error("INVALID_SIGNATURE", "Invalid signature format (must be 88 characters)"), 400);
    }

    if (err instanceof Error && err.message.includes("not found")) {
      return c.json(error("NOT_FOUND", "Transaction not found"), 404);
    }

    return c.json(
      error("FETCH_FAILED", err instanceof Error ? err.message : "Failed to fetch transaction"),
      503
    );
  }
});

export default transaction;


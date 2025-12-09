import { Hono } from "hono";
import { z } from "zod";
import type { Bindings } from "../types";
import { success, error } from "../lib/response";
import { createSolanaClient, parseAddress } from "@solana/rpc/client";
import { fetchWalletBalance } from "@solana/fetcher/balances";
import { TRACKED_TOKENS } from "@domain/money/token-registry";

const wallet = new Hono<{ Bindings: Bindings }>();

const AddressSchema = z.string().min(32).max(44);

/**
 * Get wallet balance
 * 
 * @route GET /wallet/:address/balance
 * @param {string} address - Solana wallet address
 * @returns {Object} Current SOL and token balances
 * 
 * @example
 * Request:
 * GET /api/v1/wallet/Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9/balance
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "wallet": "Hb6dzd4pYxmFYKkJDWuhzBEUkkaE93sFcvXYtriTkmw9",
 *     "timestamp": "2025-12-09T14:30:00.000Z",
 *     "balances": [
 *       {
 *         "token": "SOL",
 *         "symbol": "SOL",
 *         "amount": 2.691118332,
 *         "decimals": 9
 *       },
 *       {
 *         "token": "USDC",
 *         "symbol": "USDC",
 *         "amount": 2018.532613,
 *         "decimals": 6
 *       }
 *     ]
 *   },
 *   "meta": {
 *     "timestamp": "2025-12-09T14:30:00.000Z",
 *     "version": "1.0.0"
 *   }
 * }
 * 
 * @throws {400} Invalid wallet address
 * @throws {503} RPC connection failed
 */
wallet.get("/:address/balance", async (c) => {
  try {
    const rawAddress = c.req.param("address");
    const validAddress = AddressSchema.parse(rawAddress);

    const cacheKey = `balance:${validAddress}`;
    const cached = await c.env.CACHE.get(cacheKey);
    
    if (cached) {
      return c.json(JSON.parse(cached));
    }

    const client = createSolanaClient(c.env.RPC_URL);
    const address = parseAddress(validAddress);
    
    const balanceData = await fetchWalletBalance(client.rpc, address);

    const nonZeroTokens = balanceData.tokens.filter((t) => t.amount.ui > 0);

    const response = success({
      wallet: validAddress,
      timestamp: new Date().toISOString(),
      balances: [
        {
          token: "SOL",
          symbol: "SOL",
          amount: balanceData.sol.ui,
          decimals: 9,
        },
        ...nonZeroTokens.map((t) => ({
          token: t.mint,
          symbol: t.symbol,
          amount: t.amount.ui,
          decimals: t.decimals,
        })),
      ],
    });

    await c.env.CACHE.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 60,
    });

    return c.json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json(error("INVALID_ADDRESS", "Invalid wallet address format"), 400);
    }

    if (err instanceof Error && err.message.includes("Invalid address")) {
      return c.json(error("INVALID_ADDRESS", err.message), 400);
    }

    return c.json(
      error("BALANCE_FETCH_FAILED", err instanceof Error ? err.message : "Failed to fetch balance"),
      503
    );
  }
});

export default wallet;


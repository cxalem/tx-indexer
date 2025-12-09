import { Hono } from "hono";
import type { Bindings } from "../types";
import { success, error } from "../lib/response";

const health = new Hono<{ Bindings: Bindings }>();

/**
 * Health check endpoint
 * 
 * @route GET /health
 * @returns {Object} Health status including RPC connectivity
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "status": "healthy",
 *     "version": "1.0.0",
 *     "rpc": {
 *       "status": "connected",
 *       "url": "https://api.mainnet-beta.solana.com"
 *     }
 *   },
 *   "meta": {
 *     "timestamp": "2025-12-09T...",
 *     "version": "1.0.0"
 *   }
 * }
 */
health.get("/", async (c) => {
  try {
    const rpcUrl = c.env.RPC_URL;

    const rpcResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getHealth",
      }),
    });

    const rpcStatus = rpcResponse.ok ? "connected" : "disconnected";

    return c.json(
      success({
        status: "healthy",
        version: "1.0.0",
        rpc: {
          status: rpcStatus,
          url: rpcUrl,
        },
      })
    );
  } catch (err) {
    return c.json(
      error("HEALTH_CHECK_FAILED", err instanceof Error ? err.message : "Unknown error"),
      503
    );
  }
});

export default health;


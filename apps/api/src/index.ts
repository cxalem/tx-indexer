import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./types";
import { error } from "./lib/response";
import health from "./routes/health";
import wallet from "./routes/wallet";

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-API-Key"],
    maxAge: 600,
    credentials: false,
  })
);

app.onError((err, c) => {
  console.error("Error:", err);

  if (err.message.includes("RPC") || err.message.includes("fetch")) {
    return c.json(error("RPC_ERROR", "Failed to connect to Solana RPC"), 503);
  }

  if (err.name === "ZodError") {
    return c.json(error("VALIDATION_ERROR", err.message), 400);
  }

  return c.json(error("INTERNAL_ERROR", "Internal server error"), 500);
});

app.route("/api/v1/health", health);
app.route("/api/v1/wallet", wallet);

export default app;


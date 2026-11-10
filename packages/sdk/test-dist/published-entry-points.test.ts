/**
 * Runs against the BUILT package (dist/), not src/. Verifies that error
 * identity holds across the published entry points: an error thrown by a
 * fetcher imported from "tx-indexer/advanced" is `instanceof` the classes
 * exported from "tx-indexer" and passes `isTxIndexerError`.
 *
 * Run after building:  bun run build && bun run test:dist
 * (or: bun run build:verify)
 */
import { describe, test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createFixtureRpc,
  loadFixture,
} from "@tx-indexer/solana/__fixtures__/fixture-rpc";

const dist = join(import.meta.dir, "..", "dist");

describe("published entry points share error identity", () => {
  test("dist exists (run `bun run build` first)", () => {
    expect(existsSync(join(dist, "index.js"))).toBe(true);
    expect(existsSync(join(dist, "advanced.js"))).toBe(true);
  });

  test("advanced fetchTransaction error is instanceof the root entry's classes", async () => {
    const root = await import(join(dist, "index.js"));
    const advanced = await import(join(dist, "advanced.js"));
    const v1 = loadFixture("unsupported-version-v1-error.json");
    const { rpc } = createFixtureRpc({ [v1.meta.signature]: v1.responseText });

    const error = await advanced
      .fetchTransaction(rpc, v1.meta.signature, { retry: { maxAttempts: 1 } })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(root.UnsupportedTransactionVersionError);
    expect(error).toBeInstanceOf(root.TxIndexerError);
    expect(root.isTxIndexerError(error)).toBe(true);
    expect((error as { signature: string }).signature).toBe(v1.meta.signature);
  });
});

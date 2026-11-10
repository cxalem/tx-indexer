/**
 * Version 1 transactions (live on mainnet since 2026-09-15), replayed offline
 * from recorded mainnet responses (see __fixtures__/mainnet/README.md).
 *
 * v1 messages carry no address lookup tables: every account is a static key,
 * so `meta.loadedAddresses` is present but empty and the resolved key list is
 * exactly `transaction.message.accountKeys`. Balances, token `accountIndex`
 * and `meta.fee` keep their v0 meaning.
 */
import { describe, test, expect } from "bun:test";
import type { Signature } from "@solana/kit";
import { fetchTransaction } from "../fetcher/transactions";
import { transactionToLegs } from "./transaction-to-legs";
import { extractSolBalanceChanges } from "./balance-parser";
import { createFixtureRpc, loadFixture } from "../__fixtures__/fixture-rpc";

async function fetchFixture(name: string) {
  const { meta, responseText } = loadFixture(name);
  const { rpc, calls } = createFixtureRpc({ [meta.signature]: responseText });
  const tx = await fetchTransaction(rpc, meta.signature as Signature);
  if (!tx) throw new Error("fixture returned null");
  return { tx, meta, calls };
}

const cases = [
  {
    name: "v1-jupiter-swap-token-to-token.json",
    keys: 49,
    fee: 14200,
    feePayer: "Fni6bHeAT9scmcuYjy95EADowAXFt21Q5YzYjkPjswxY",
    solChanges: [
      [0, -14200n],
      [5, -3685826317n],
      [13, 3684912174n],
      [24, 914143n],
    ],
  },
  {
    name: "v1-swap-sol-to-token.json",
    keys: 38,
    fee: 12971,
    feePayer: "Dha7rX3GixRswSnxqhFA4W1i8fH8mixNmQrJBKF4miye",
    solChanges: [
      [0, -313285060n],
      [2, 1396169n],
      [6, 1513840n],
      [7, 10000n],
      [10, 308863640n],
      [14, 1488440n],
    ],
  },
  {
    name: "v1-jupiter-route-usdc-gain.json",
    keys: 35,
    fee: 7559,
    feePayer: "CGgMCsQ6kQ2J3BV5ZDh3J7BCMC75JNLbYNMrLttGEpFz",
    solChanges: [[0, -7559n]],
  },
] as const;

describe("recorded v1 transactions", () => {
  for (const c of cases) {
    test(`${c.name}: requested as v1, all keys static, balanced, fee leg is meta.fee`, async () => {
      const { tx, meta, calls } = await fetchFixture(c.name);
      expect(meta.version).toBe(1);
      expect((calls[0]!.params as unknown[])[1]).toMatchObject({
        maxSupportedTransactionVersion: 1,
        encoding: "json",
      });

      // Key resolution: static keys only, one per balance entry.
      expect(tx.accountKeys).toHaveLength(c.keys);
      expect(tx.preBalances).toHaveLength(c.keys);
      expect(tx.postBalances).toHaveLength(c.keys);
      expect(tx.loadedAddresses).toEqual({ writable: [], readonly: [] });
      expect(tx.accountKeys![0]).toBe(c.feePayer);

      // Lamports: exact deltas, reconciled against meta.fee.
      expect(tx.fee).toBe(c.fee);
      expect(
        extractSolBalanceChanges(tx).map((s) => [s.accountIndex, s.change]),
      ).toEqual(c.solChanges.map(([i, d]) => [i, d]));
      expect(tx.reconciliation).toEqual({
        status: "balanced",
        feeLamports: String(c.fee),
        netLamportsOut: String(c.fee),
        residualLamports: "0",
        accountCount: c.keys,
      });

      const feeLegs = transactionToLegs(tx).filter((l) => l.role === "fee");
      expect(feeLegs).toHaveLength(1);
      expect(feeLegs[0]!.accountId).toBe("fee:network");
      expect(feeLegs[0]!.amount.amountRaw).toBe(String(c.fee));
    });
  }
});

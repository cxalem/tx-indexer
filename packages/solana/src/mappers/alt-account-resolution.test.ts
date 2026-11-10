/**
 * Lookup-table (ALT) account resolution: lamport movements on accounts loaded
 * from address lookup tables must appear as legs, and the fee leg must be the
 * fee the runtime charged (meta.fee), not a residual.
 *
 * This file deliberately imports only modules that exist on main, so it can be
 * run against the old mapping to demonstrate the omission.
 */
import { describe, test, expect } from "bun:test";
import type { Signature } from "@solana/kit";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { fetchTransaction } from "../fetcher/transactions";
import { transactionToLegs } from "./transaction-to-legs";
import { extractSolBalanceChanges } from "./balance-parser";
import {
  createFixtureRpc,
  loadFixture,
} from "../__fixtures__/fixture-rpc";
import {
  SOL,
  SENDER,
  RECEIVER,
  SYSTEM_PROGRAM,
  mockRpc,
  syntheticResponse,
} from "../__fixtures__/synthetic";

const SIG = "TestSignature1111111111111111111111111111111111111111111111111111111111111111111111111" as Signature;

function solLegs(legs: TxLeg[]) {
  return legs
    .filter((l) => l.amount.token.symbol === "SOL")
    .map((l) => `${l.accountId} ${l.side} ${l.amount.amountRaw} ${l.role}`)
    .sort();
}

async function fetchSynthetic(input: Parameters<typeof syntheticResponse>[0]) {
  const { rpc } = mockRpc(() => syntheticResponse(input));
  const tx = await fetchTransaction(rpc, SIG);
  if (!tx) throw new Error("expected a transaction");
  return tx;
}

describe("synthetic: lookup-table accounts with lamport changes", () => {
  test("omitted credit: 1 SOL to a lookup-table receiver yields the receiver credit and the real fee", async () => {
    const tx = await fetchSynthetic({
      staticKeys: [SENDER, SYSTEM_PROGRAM],
      loaded: { writable: [RECEIVER], readonly: [] },
      pre: [10n * SOL, 1n, 2n * SOL],
      post: [10n * SOL - SOL - 5000n, 1n, 3n * SOL],
      fee: 5000n,
    });

    expect(tx.accountKeys).toEqual([SENDER, SYSTEM_PROGRAM, RECEIVER]);
    expect(solLegs(transactionToLegs(tx))).toEqual(
      [
        `external:${SENDER} debit 1000005000 sent`,
        `external:${RECEIVER} credit 1000000000 received`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );
  });

  test("omitted debit: lookup-table account pays the static fee payer", async () => {
    const tx = await fetchSynthetic({
      staticKeys: [RECEIVER, SYSTEM_PROGRAM],
      loaded: { writable: [SENDER], readonly: [] },
      pre: [1n * SOL, 1n, 5n * SOL],
      post: [2n * SOL - 5000n, 1n, 4n * SOL],
      fee: 5000n,
    });

    expect(solLegs(transactionToLegs(tx))).toEqual(
      [
        `external:${RECEIVER} credit 999995000 received`,
        `external:${SENDER} debit 1000000000 sent`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );
  });

  test("omitted changes that net to zero are still reported (fee equality must not hide legs)", async () => {
    const A = "LoadedA111111111111111111111111111111111111";
    const B = "LoadedB111111111111111111111111111111111111";
    const tx = await fetchSynthetic({
      staticKeys: [SENDER, SYSTEM_PROGRAM],
      loaded: { writable: [A, B], readonly: [] },
      pre: [SOL, 1n, 3n * SOL, 0n],
      post: [SOL - 5000n, 1n, 2n * SOL, SOL],
      fee: 5000n,
    });

    // With static keys only, debits - credits would still equal the fee
    // (5000), which is exactly why fee equality cannot be the only check.
    expect(solLegs(transactionToLegs(tx))).toEqual(
      [
        `external:${SENDER} debit 5000 sent`,
        `external:${A} debit 1000000000 sent`,
        `external:${B} credit 1000000000 received`,
        `fee:network credit 5000 fee`,
      ].sort(),
    );
  });

  test("multiple lookup tables: all writable addresses precede all readonly addresses", async () => {
    // Two tables: T1 contributes W1 (writable) + R1 (readonly), T2 contributes
    // W2 + R2. The RPC reports loadedAddresses already grouped by kind.
    const tx = await fetchSynthetic({
      staticKeys: [SENDER, SYSTEM_PROGRAM],
      loaded: { writable: ["W1", "W2"], readonly: ["R1", "R2"] },
      pre: [SOL, 1n, 10n, 20n, 30n, 40n],
      post: [SOL - 5000n - 7n, 1n, 10n, 27n, 30n, 40n],
      fee: 5000n,
    });

    expect(tx.accountKeys).toEqual([SENDER, SYSTEM_PROGRAM, "W1", "W2", "R1", "R2"]);
    const changes = extractSolBalanceChanges(tx);
    expect(changes.map((c) => [c.accountIndex, c.address, c.change])).toEqual([
      [0, SENDER, -5007n],
      [3, "W2", 7n],
    ]);
  });

  test("balances above Number.MAX_SAFE_INTEGER keep exact deltas", async () => {
    const big = 2n ** 60n + 123n; // > 9007199254740991
    const tx = await fetchSynthetic({
      staticKeys: [SENDER, SYSTEM_PROGRAM],
      loaded: { writable: [RECEIVER], readonly: [] },
      pre: [big, 1n, big + 1n],
      post: [big - 1n - 5000n, 1n, big + 2n],
      fee: 5000n,
    });

    const changes = extractSolBalanceChanges(tx);
    expect(changes.map((c) => c.change)).toEqual([-5001n, 1n]);
    expect(changes[1]!.postBalance).toBe(big + 2n);
    expect(solLegs(transactionToLegs(tx))).toContain(
      `external:${RECEIVER} credit 1 received`,
    );
  });
});

describe("recorded mainnet fixtures (replayed through a kit RPC)", () => {
  async function fetchFixture(name: string) {
    const { meta, responseText } = loadFixture(name);
    const { rpc } = createFixtureRpc({ [meta.signature]: responseText });
    const tx = await fetchTransaction(rpc, meta.signature as Signature);
    if (!tx) throw new Error("fixture returned null");
    return tx;
  }

  // In all three swaps the lookup-table writable accounts whose lamports
  // change are wSOL token accounts (pool vaults / fee account). Their lamport
  // change is exactly the wSOL token change, so it appears ONCE, as the wSOL
  // token leg attributed to the token owner; no separate lamport leg and no
  // rent remainder. The fee leg is meta.fee.

  test("Jupiter SOL -> token swap: full key list, wSOL once, fee leg is meta.fee", async () => {
    const tx = await fetchFixture("jupiter-swap-sol-to-token.json");
    expect(tx.accountKeys).toHaveLength(17); // 9 static + 3 writable + 5 readonly
    expect(tx.accountKeys![10]).toBe("C47dRtozmsagyUSwaejLiBSPemvHK7J7U7UH8jibviqp");
    expect(tx.fee).toBe(5039);
    expect(extractSolBalanceChanges(tx).map((c) => [c.accountIndex, c.change])).toEqual([
      [0, -4147883n],
      [10, 4142844n],
    ]);
    expect(solLegs(transactionToLegs(tx))).toEqual(
      [
        "external:EMgSdxvQqmaqjynWyNeEXcgpMDERxD7ntvBcUWr3PaEb debit 4147883 sent",
        // wSOL token leg of vault C47d... (owner = pool authority HLnp...)
        "external:HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC credit 4142844 received",
        "fee:network credit 5039 fee",
      ].sort(),
    );
  });

  test("Jupiter token -> SOL swap: vault debit appears once (as wSOL), fee leg present", async () => {
    const tx = await fetchFixture("jupiter-swap-token-to-sol.json");
    expect(tx.accountKeys).toHaveLength(15); // 9 static + 3 writable + 3 readonly
    expect(extractSolBalanceChanges(tx).map((c) => [c.accountIndex, c.change])).toEqual([
      [0, 22237362n],
      [9, -22242362n],
    ]);
    expect(solLegs(transactionToLegs(tx))).toEqual(
      [
        "external:6bAWX3qmkmmqmzqsNeWMPTA9iG5k9VfagLBssJxE3Uuh credit 22237362 received",
        // wSOL token leg of vault 3Qju... (owner = pool authority 5Q54...)
        "external:5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1 debit 22242362 sent",
        "fee:network credit 5000 fee",
      ].sort(),
    );
  });

  test("Jupiter swap with two lookup-table wSOL credits (vault + fee account)", async () => {
    const tx = await fetchFixture("jupiter-swap-with-alt-fee-account.json");
    expect(tx.accountKeys).toHaveLength(21); // 10 static + 4 writable + 7 readonly
    expect(extractSolBalanceChanges(tx).map((c) => [c.accountIndex, c.change])).toEqual([
      [0, -182605000n],
      [11, 182354941n],
      [12, 45059n],
    ]);
    expect(solLegs(transactionToLegs(tx))).toEqual(
      [
        "external:HyotTjJEuufx749H3FE2ENz3tyP47ddv5G2RhKJPNkqg debit 182605000 sent",
        // wSOL token legs of 8Tyq... and CASR... (by owner)
        "external:3mxDjdZ1gAe5HziC4dj4UnLdXJ5DBcC9jsSYq55mFyKg credit 182354941 received",
        "external:5eHhjP8JaYkz83CWwvGU2uMUXefd3AazWGx4gpcuEEYD credit 45059 received",
        "fee:network credit 205000 fee",
      ].sort(),
    );
  });
});

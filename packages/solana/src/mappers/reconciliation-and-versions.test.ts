import { describe, test, expect, afterEach } from "bun:test";
import type { Signature } from "@solana/kit";
import type { RawTransaction } from "@tx-indexer/core/tx/tx.types";
import { resolveAccountKeys, normalizeLoadedAddresses } from "./account-keys";
import { reconcileLamports } from "./lamport-reconciliation";
import { extractSolBalanceChanges } from "./balance-parser";
import { transactionToLegs } from "./transaction-to-legs";
import {
  fetchTransaction,
  fetchTransactionsBatch,
} from "../fetcher/transactions";
import { fetchTransactionsBatched } from "../rpc/batch";
import {
  UnsupportedTransactionVersionError,
  isUnsupportedTransactionVersionRpcError,
  type SkippedTransaction,
} from "../rpc/errors";
import { createFixtureRpc, loadFixture } from "../__fixtures__/fixture-rpc";
import {
  SOL,
  SENDER,
  RECEIVER,
  SYSTEM_PROGRAM,
  mockRpc,
  syntheticResponse,
} from "../__fixtures__/synthetic";

const SIG = "TestSignature1111111111111111111111111111111111111111111111111111111111111111111111111" as Signature;

describe("resolveAccountKeys", () => {
  test("static, then writable, then readonly; no sorting, no dedupe", () => {
    expect(
      resolveAccountKeys(["P", "Z", "A"], { writable: ["Z", "B"], readonly: ["A", "C"] }),
    ).toEqual(["P", "Z", "A", "Z", "B", "A", "C"]);
  });

  test("legacy (no loadedAddresses) and empty lookups resolve to static keys", () => {
    expect(resolveAccountKeys(["P", "X"])).toEqual(["P", "X"]);
    expect(resolveAccountKeys(["P", "X"], null)).toEqual(["P", "X"]);
    expect(resolveAccountKeys(["P", "X"], { writable: [], readonly: [] })).toEqual(["P", "X"]);
  });

  test("accepts kit Address objects and {pubkey} keys", () => {
    expect(
      resolveAccountKeys([{ toString: () => "P" }, { pubkey: "Q" }], {
        writable: [{ toString: () => "W" }],
        readonly: [],
      }),
    ).toEqual(["P", "Q", "W"]);
    expect(normalizeLoadedAddresses(undefined)).toBeUndefined();
  });
});

describe("legacy and empty-lookup transactions are unchanged", () => {
  const base = {
    staticKeys: [SENDER, RECEIVER, SYSTEM_PROGRAM],
    pre: [10n * SOL, 2n * SOL, 1n],
    post: [9n * SOL - 5000n, 3n * SOL, 1n],
    fee: 5000n,
  };
  const expectedLegs = [
    `external:${SENDER} debit 1000005000 sent`,
    `external:${RECEIVER} credit 1000000000 received`,
    `fee:network credit 5000 fee`,
  ].sort();

  for (const [label, extra] of [
    ["legacy", { version: "legacy" as const, loaded: null }],
    ["v0 with empty lookups", { version: 0 as const, loaded: { writable: [], readonly: [] } }],
  ] as const) {
    test(label, async () => {
      const { rpc } = mockRpc(() => syntheticResponse({ ...base, ...extra }));
      const tx = (await fetchTransaction(rpc, SIG))!;
      expect(tx.accountKeys).toEqual([SENDER, RECEIVER, SYSTEM_PROGRAM]);
      expect(tx.accountKeys![0]).toBe(SENDER);
      expect(tx.programIds).toEqual([SYSTEM_PROGRAM]);
      expect(tx.fee).toBe(5000);
      expect(tx.reconciliation?.status).toBe("balanced");
      expect(
        transactionToLegs(tx)
          .map((l) => `${l.accountId} ${l.side} ${l.amount.amountRaw} ${l.role}`)
          .sort(),
      ).toEqual(expectedLegs);
    });
  }
});

describe("reconcileLamports", () => {
  function raw(over: Partial<RawTransaction>): RawTransaction {
    return {
      signature: SIG,
      slot: 1n,
      blockTime: null,
      err: null,
      programIds: [],
      protocol: null,
      fee: 5000,
      accountKeys: ["A", "B"],
      preBalances: [10000n, 0n],
      postBalances: [4000n, 1000n],
      ...over,
    };
  }

  test("balanced when sum(pre) - sum(post) equals the fee", () => {
    expect(reconcileLamports(raw({}))).toEqual({
      status: "balanced",
      feeLamports: "5000",
      netLamportsOut: "5000",
      residualLamports: "0",
      accountCount: 2,
    });
  });

  test("an unexplained residual is reported, never renamed fee", () => {
    // Static-only view of a lookup-table transfer: receiver credit omitted.
    const tx = raw({
      accountKeys: ["A"],
      preBalances: [10n * SOL],
      postBalances: [9n * SOL - 5000n],
    });
    const r = reconcileLamports(tx);
    expect(r.status).toBe("unbalanced");
    expect(r.residualLamports).toBe("1000000000");
    const feeLeg = transactionToLegs(tx).find((l) => l.role === "fee")!;
    expect(feeLeg.amount.amountRaw).toBe("5000");
  });

  test("missing metadata is unavailable and fabricates no balances", async () => {
    const { rpc } = mockRpc(() =>
      syntheticResponse({ staticKeys: [SENDER, SYSTEM_PROGRAM], pre: [], post: [], metaNull: true }),
    );
    const tx = (await fetchTransaction(rpc, SIG))!;
    expect(tx.fee).toBeUndefined();
    expect(tx.reconciliation?.status).toBe("unavailable");
    expect(extractSolBalanceChanges(tx)).toEqual([]);
    expect(transactionToLegs(tx)).toEqual([]);
  });

  test("balance arrays that do not match the resolved key count are unavailable", () => {
    // e.g. loadedAddresses missing while balances cover the full list
    const tx = raw({
      accountKeys: ["A", "B"],
      preBalances: [10000n, 0n, 7n],
      postBalances: [4000n, 1000n, 0n],
    });
    const r = reconcileLamports(tx);
    expect(r.status).toBe("unavailable");
    expect(r.reason).toContain("length mismatch");
    // Only indices that have a key and both balances are considered.
    expect(extractSolBalanceChanges(tx).map((c) => c.address)).toEqual(["A", "B"]);
  });

  test("short balance arrays do not get zero-filled", () => {
    const tx = raw({ accountKeys: ["A", "B", "C"], preBalances: [10n], postBalances: [5n] });
    expect(reconcileLamports(tx).status).toBe("unavailable");
    expect(extractSolBalanceChanges(tx).map((c) => c.address)).toEqual(["A"]);
  });

  test("missing fee is unavailable", () => {
    expect(reconcileLamports(raw({ fee: undefined })).status).toBe("unavailable");
  });

  test("unsafe JS-number balances are unavailable, not silently rounded", () => {
    const tx = raw({
      preBalances: [2 ** 60, 0],
      postBalances: [2 ** 60 - 6000, 1000],
    });
    const r = reconcileLamports(tx);
    expect(r.status).toBe("unavailable");
    expect(r.reason).toContain("MAX_SAFE_INTEGER");
  });

  test("bigint balances above MAX_SAFE_INTEGER reconcile exactly", () => {
    const big = 2n ** 62n + 1n;
    expect(
      reconcileLamports(raw({ preBalances: [big, big], postBalances: [big - 5001n, big + 1n] })).status,
    ).toBe("balanced");
  });

  test("recorded fixtures reconcile as balanced over the full list", async () => {
    for (const name of [
      "jupiter-swap-sol-to-token.json",
      "jupiter-swap-token-to-sol.json",
      "jupiter-swap-with-alt-fee-account.json",
    ]) {
      const { meta, responseText } = loadFixture(name);
      const { rpc } = createFixtureRpc({ [meta.signature]: responseText });
      const tx = (await fetchTransaction(rpc, meta.signature as Signature))!;
      expect(tx.reconciliation?.status).toBe("balanced");
      expect(tx.reconciliation?.feeLamports).toBe(String(tx.fee));
      expect(tx.loadedAddresses?.writable.length).toBeGreaterThan(0);
    }
  });
});

describe("unsupported transaction versions", () => {
  const v2 = loadFixture("unsupported-version-synthetic-v2-error.json");

  test("a -32015 for a version above 1 (synthetic v2) surfaces as UnsupportedTransactionVersionError with the signature, without retries", async () => {
    const { rpc, calls } = createFixtureRpc({ [v2.meta.signature]: v2.responseText });
    const error = await fetchTransaction(rpc, v2.meta.signature as Signature, {
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
    }).catch((e) => e);

    expect(error).toBeInstanceOf(UnsupportedTransactionVersionError);
    expect(error.signature).toBe(v2.meta.signature);
    expect(error.code).toBe("UNSUPPORTED_TRANSACTION_VERSION");
    expect(error.retryable).toBe(false);
    expect(error.transactionVersion).toBe(2);
    expect(error.maxSupportedTransactionVersion).toBe(1);
    expect(calls).toHaveLength(1);
    // The request asked for up to version 1.
    expect((calls[0]!.params as unknown[])[1]).toMatchObject({
      maxSupportedTransactionVersion: 1,
      encoding: "json",
    });
  });

  test("detects kit, raw JSON-RPC and message forms; ignores unrelated errors", () => {
    expect(isUnsupportedTransactionVersionRpcError({ code: -32015, message: "x" })).toBe(true);
    expect(isUnsupportedTransactionVersionRpcError({ context: { __code: -32015 } })).toBe(true);
    expect(isUnsupportedTransactionVersionRpcError(new Error("Transaction version (1) is not supported by the requesting client"))).toBe(true);
    expect(isUnsupportedTransactionVersionRpcError(new Error("429 Too Many Requests"))).toBe(false);
    expect(isUnsupportedTransactionVersionRpcError(null)).toBe(false);
  });

  test("fetchTransactionsBatch reports not_found, unsupported_version and fetch_failed distinctly", async () => {
    const good = syntheticResponse({
      staticKeys: [SENDER, SYSTEM_PROGRAM],
      pre: [SOL, 1n],
      post: [SOL - 5000n, 1n],
    });
    const { rpc } = mockRpc((sig) => {
      if (sig === "missing") return null;
      if (sig === "v1") {
        const err = new Error("Transaction version (1) is not supported by the requesting client.");
        Object.assign(err, { context: { __code: -32015 } });
        throw err;
      }
      if (sig === "boom") throw new Error("upstream exploded");
      return good;
    });
    const skipped: SkippedTransaction[] = [];
    const fetchErrors: string[] = [];
    const result = await fetchTransactionsBatch(
      rpc,
      ["ok", "missing", "v1", "boom"] as Signature[],
      {
        retry: { maxAttempts: 1 },
        onSkipped: (s) => skipped.push(s),
        onFetchError: (sig) => fetchErrors.push(String(sig)),
      },
    );

    expect(result).toHaveLength(1);
    const bySig = Object.fromEntries(skipped.map((s) => [s.signature, s]));
    expect(bySig.missing?.reason).toBe("not_found");
    expect(bySig.missing?.error).toBeUndefined();
    expect(bySig.v1?.reason).toBe("unsupported_version");
    expect(bySig.v1?.error).toBeInstanceOf(UnsupportedTransactionVersionError);
    expect((bySig.v1?.error as UnsupportedTransactionVersionError).signature).toBe("v1");
    expect(bySig.boom?.reason).toBe("fetch_failed");
    expect(fetchErrors.sort()).toEqual(["boom", "v1"]);
  });
});

describe("JSON-RPC batch path (rpc/batch.ts) stays consistent", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function installFetch(bodies: Array<Record<string, unknown>>) {
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      const requests = JSON.parse(String(init?.body)) as Array<{ id: number }>;
      const out = requests.map((r, i) => ({ jsonrpc: "2.0", id: r.id, ...bodies[i] }));
      return new Response(JSON.stringify(out), { status: 200 });
    }) as unknown as typeof fetch;
  }

  test("resolves lookup-table keys, flags unsafe integers, reports unsupported versions", async () => {
    const big = 2 ** 60; // already imprecise once it is a JS number
    installFetch([
      {
        result: {
          slot: 1,
          blockTime: 2,
          meta: {
            fee: 5000,
            err: null,
            preBalances: [10 * 1e9, 1, 2 * 1e9],
            postBalances: [9 * 1e9 - 5000, 1, 3 * 1e9],
            loadedAddresses: { writable: [RECEIVER], readonly: [] },
          },
          transaction: {
            message: {
              accountKeys: [SENDER, SYSTEM_PROGRAM],
              instructions: [{ programIdIndex: 1, accounts: [0, 2] }],
            },
            signatures: ["a"],
          },
        },
      },
      {
        result: {
          slot: 1,
          blockTime: 2,
          meta: {
            fee: 5000,
            err: null,
            preBalances: [big, 1],
            postBalances: [big - 5000, 1],
          },
          transaction: {
            message: { accountKeys: [SENDER, SYSTEM_PROGRAM], instructions: [] },
            signatures: ["b"],
          },
        },
      },
      {
        error: {
          code: -32015,
          message: "Transaction version (1) is not supported by the requesting client.",
        },
      },
    ]);

    const skipped: SkippedTransaction[] = [];
    const originalWarn = console.warn;
    console.warn = () => {};
    const txs = await fetchTransactionsBatched(
      "http://fixture.invalid",
      ["a", "b", "c"] as Signature[],
      { requestsPerSecond: 0, onSkipped: (s) => skipped.push(s) },
    ).finally(() => {
      console.warn = originalWarn;
    });

    expect(txs).toHaveLength(2);
    expect(txs[0]!.accountKeys).toEqual([SENDER, SYSTEM_PROGRAM, RECEIVER]);
    expect(txs[0]!.reconciliation?.status).toBe("balanced");
    expect(txs[1]!.reconciliation?.status).toBe("unavailable");
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.signature).toBe("c");
    expect(skipped[0]!.reason).toBe("unsupported_version");
  });
});

/**
 * Regression tests for review rounds 1-2: wSOL represented once (owner-
 * attributed lamports) and wallet-directed stake classification.
 */
import { describe, test, expect } from "bun:test";
import type { Signature } from "@solana/kit";
import type { RawTransaction } from "@tx-indexer/core/tx/tx.types";
import { fetchTransaction } from "@tx-indexer/solana/fetcher/transactions";
import { transactionToLegs } from "@tx-indexer/solana/mappers/transaction-to-legs";
import { classifyTransaction } from "../../engine/classification-service";
import {
  SOL,
  mockRpc,
  syntheticResponse,
  WSOL_MINT,
  TOKEN_PROGRAM,
  SYSTEM_PROGRAM,
} from "@tx-indexer/solana/__fixtures__/synthetic";

const SIG = "ReviewSignature11111111111111111111111111111111111111111111111111111111111111111111111" as Signature;
const ALICE = "A1ice11111111111111111111111111111111111111";
const BOB = "Bob1111111111111111111111111111111111111111";
const ALICE_ATA = "A1iceATA111111111111111111111111111111111111";
const BOB_ATA = "BobATA11111111111111111111111111111111111111";
const RESERVE = "Reserve1111111111111111111111111111111111111";
const SPONSOR = "Sponsor111111111111111111111111111111111111";
const POOL_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";
const POOL_ATA = "A1icePoo1ATA1111111111111111111111111111111";
const RENT = 2039280n;

async function run(
  response: unknown,
  opts: { protocol?: RawTransaction["protocol"]; walletAddress?: string; memo?: string } = {},
) {
  const { rpc } = mockRpc(() => response);
  const tx = (await fetchTransaction(rpc, SIG))!;
  tx.protocol = opts.protocol ?? null;
  if (opts.memo) tx.memo = opts.memo;
  const legs = transactionToLegs(tx, opts.walletAddress);
  return { tx, legs, classification: classifyTransaction(legs, tx, opts.walletAddress) };
}

describe("P1-1: wSOL transfer via token accounts, static vs lookup-table twin", () => {
  const tokenBalances = (aliceIdx: number, bobIdx: number) => ({
    preTokenBalances: [
      { accountIndex: aliceIdx, mint: WSOL_MINT, owner: ALICE, amount: 2n * SOL },
      { accountIndex: bobIdx, mint: WSOL_MINT, owner: BOB, amount: 0n },
    ],
    postTokenBalances: [
      { accountIndex: aliceIdx, mint: WSOL_MINT, owner: ALICE, amount: SOL },
      { accountIndex: bobIdx, mint: WSOL_MINT, owner: BOB, amount: SOL },
    ],
  });

  for (const withWallet of [false, true]) {
    test(`sender = Alice, receiver = Bob in both (walletAddress ${withWallet ? "set" : "unset"})`, async () => {
      const walletAddress = withWallet ? ALICE : undefined;
      const staticTwin = await run(
        syntheticResponse({
          staticKeys: [ALICE, ALICE_ATA, BOB_ATA, TOKEN_PROGRAM],
          pre: [SOL, RENT + 2n * SOL, RENT, 1n],
          post: [SOL - 5000n, RENT + SOL, RENT + SOL, 1n],
          instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
          ...tokenBalances(1, 2),
        }),
        { walletAddress },
      );
      const altTwin = await run(
        syntheticResponse({
          staticKeys: [ALICE, TOKEN_PROGRAM],
          loaded: { writable: [ALICE_ATA, BOB_ATA], readonly: [] },
          pre: [SOL, 1n, RENT + 2n * SOL, RENT],
          post: [SOL - 5000n, 1n, RENT + SOL, RENT + SOL],
          instructions: [{ programIdIndex: 1, accounts: [2, 3, 0] }],
          ...tokenBalances(2, 3),
        }),
        { walletAddress },
      );
      for (const twin of [staticTwin, altTwin]) {
        expect(twin.classification.primaryType).toBe("transfer");
        expect(twin.classification.sender).toBe(ALICE);
        expect(twin.classification.receiver).toBe(BOB);
        expect(twin.classification.primaryAmount?.amountRaw).toBe(SOL.toString());
      }
    });
  }
});

describe("P1-2: stake pool with a lookup-table reserve", () => {
  const protocol = { id: "stake-pool", name: "Stake Pool Program" };

  for (const walletAddress of [ALICE, undefined]) {
    const label = walletAddress ? "with walletAddress" : "fee-payer fallback";

    test(`withdrawal from the reserve is stake_withdraw to Alice (${label})`, async () => {
      const { classification } = await run(
        syntheticResponse({
          staticKeys: [ALICE, POOL_ATA, SYSTEM_PROGRAM],
          loaded: { writable: [RESERVE], readonly: [] },
          pre: [SOL, RENT, 1n, 100n * SOL],
          post: [SOL + 999_995_000n, RENT, 1n, 99n * SOL],
          preTokenBalances: [{ accountIndex: 1, mint: POOL_MINT, owner: ALICE, amount: 5n * SOL }],
          postTokenBalances: [{ accountIndex: 1, mint: POOL_MINT, owner: ALICE, amount: 4n * SOL }],
        }),
        { protocol, walletAddress },
      );
      expect(classification.primaryType).toBe("stake_withdraw");
      expect(classification.receiver).toBe(ALICE);
      expect(classification.primaryAmount?.amountRaw).toBe("999995000");
    });

    test(`deposit into the reserve is stake_deposit from Alice (${label})`, async () => {
      const { classification } = await run(
        syntheticResponse({
          staticKeys: [ALICE, POOL_ATA, SYSTEM_PROGRAM],
          loaded: { writable: [RESERVE], readonly: [] },
          pre: [5n * SOL, RENT, 1n, 100n * SOL],
          post: [4n * SOL - 5000n, RENT, 1n, 101n * SOL],
          preTokenBalances: [{ accountIndex: 1, mint: POOL_MINT, owner: ALICE, amount: 0n }],
          postTokenBalances: [{ accountIndex: 1, mint: POOL_MINT, owner: ALICE, amount: SOL }],
        }),
        { protocol, walletAddress },
      );
      expect(classification.primaryType).toBe("stake_deposit");
      expect(classification.sender).toBe(ALICE);
      expect(classification.primaryAmount?.amountRaw).toBe("1000005000");
    });
  }
});

describe("P1-2 / ruling D: sponsored stake-pool deposit", () => {
  const protocol = { id: "stake-pool", name: "Stake Pool Program" };
  const sponsored = syntheticResponse({
    staticKeys: [SPONSOR, ALICE, POOL_ATA, SYSTEM_PROGRAM],
    loaded: { writable: [RESERVE], readonly: [] },
    pre: [5n * SOL, 0n, RENT, 1n, 100n * SOL],
    post: [4n * SOL - 5000n, 0n, RENT, 1n, 101n * SOL],
    preTokenBalances: [{ accountIndex: 2, mint: POOL_MINT, owner: ALICE, amount: 0n }],
    postTokenBalances: [{ accountIndex: 2, mint: POOL_MINT, owner: ALICE, amount: SOL }],
  });

  test("walletAddress = Alice (receives pool tokens, no SOL debit): stake_deposit funded by Sponsor", async () => {
    const { classification } = await run(sponsored, { protocol, walletAddress: ALICE });
    expect(classification.primaryType).toBe("stake_deposit");
    expect(classification.sender).toBe(SPONSOR);
    expect(classification.primaryAmount?.amountRaw).toBe("1000005000");
  });

  test("no walletAddress (fee payer = Sponsor): stake_deposit from Sponsor", async () => {
    const { classification } = await run(sponsored, { protocol });
    expect(classification.primaryType).toBe("stake_deposit");
    expect(classification.sender).toBe(SPONSOR);
  });
});

describe("ruling B: wSOL economic movement is the lamport delta, owner-attributed", () => {
  const fmt = (legs: { accountId: string; side: string; amount: { amountRaw: string }; role: string }[]) =>
    legs.map((l) => `${l.accountId} ${l.side} ${l.amount.amountRaw} ${l.role}`).sort();

  test("repro 1: SOL sent to Bob's existing wSOL account without sync_native is a transfer Alice -> Bob", async () => {
    const { legs, classification } = await run(
      syntheticResponse({
        staticKeys: [ALICE, SYSTEM_PROGRAM],
        loaded: { writable: [BOB_ATA], readonly: [] },
        pre: [5n * SOL, 1n, RENT],
        post: [4n * SOL - 5000n, 1n, RENT + SOL],
        instructions: [{ programIdIndex: 1, accounts: [0, 2] }],
        preTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: BOB, amount: 0n }],
        postTokenBalances: [{ accountIndex: 2, mint: WSOL_MINT, owner: BOB, amount: 0n }],
      }),
    );
    expect(fmt(legs)).toEqual(
      [
        `external:${ALICE} debit 1000005000 sent`,
        `external:${BOB} credit 1000000000 received`,
        "fee:network credit 5000 fee",
      ].sort(),
    );
    expect(classification.primaryType).toBe("transfer");
    expect(classification.sender).toBe(ALICE);
    expect(classification.receiver).toBe(BOB);
  });

  test("repro 2: unsynced account syncs and sends 1 wSOL; movement is the 1 SOL lamport delta, not the sync", async () => {
    // AliceATA holds R + 3 SOL but tracks only 1 wSOL; she syncs (token -> 3)
    // and sends 1 wSOL to Bob (token -> 2, lamports R + 2 SOL).
    const { legs, classification } = await run(
      syntheticResponse({
        staticKeys: [ALICE, TOKEN_PROGRAM],
        loaded: { writable: [ALICE_ATA, BOB_ATA], readonly: [] },
        pre: [SOL, 1n, RENT + 3n * SOL, RENT],
        post: [SOL - 5000n, 1n, RENT + 2n * SOL, RENT + SOL],
        instructions: [{ programIdIndex: 1, accounts: [2, 3, 0] }],
        preTokenBalances: [
          { accountIndex: 2, mint: WSOL_MINT, owner: ALICE, amount: SOL },
          { accountIndex: 3, mint: WSOL_MINT, owner: BOB, amount: 0n },
        ],
        postTokenBalances: [
          { accountIndex: 2, mint: WSOL_MINT, owner: ALICE, amount: 2n * SOL },
          { accountIndex: 3, mint: WSOL_MINT, owner: BOB, amount: SOL },
        ],
      }),
      { walletAddress: ALICE },
    );
    expect(fmt(legs)).toEqual(
      [
        `external:${ALICE} debit 5000 sent`,
        `external:${ALICE} debit 1000000000 sent`,
        `external:${BOB} credit 1000000000 received`,
        "fee:network credit 5000 fee",
      ].sort(),
    );
    expect(classification.primaryType).toBe("transfer");
    expect(classification.sender).toBe(ALICE);
    expect(classification.receiver).toBe(BOB);
    expect(classification.primaryAmount?.amountRaw).toBe(SOL.toString());
  });
});

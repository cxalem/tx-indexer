/**
 * Regression tests for review round 1: newly visible lookup-table lamport legs
 * must not displace the wallet as participant in any classifier.
 */
import { describe, test, expect } from "bun:test";
import type { Signature } from "@solana/kit";
import type { RawTransaction, TxLeg } from "@tx-indexer/core/tx/tx.types";
import { fetchTransaction } from "@tx-indexer/solana/fetcher/transactions";
import { transactionToLegs } from "@tx-indexer/solana/mappers/transaction-to-legs";
import { classifyTransaction } from "../../engine/classification-service";
import { NftMintClassifier } from "../../classifiers/nft-mint-classifier";
import { NftTransferClassifier } from "../../classifiers/nft-transfer-classifier";
import {
  SOL,
  mockRpc,
  syntheticResponse,
  WSOL_MINT,
  TOKEN_PROGRAM,
  SYSTEM_PROGRAM,
} from "@tx-indexer/solana/__fixtures__/synthetic";
import {
  createMockLeg,
  createMockTransaction,
  createSolAmount,
  createNftAmount,
} from "../fixtures/mock-factories";

const SIG = "ReviewSignature11111111111111111111111111111111111111111111111111111111111111111111111" as Signature;
const ALICE = "A1ice11111111111111111111111111111111111111";
const BOB = "Bob1111111111111111111111111111111111111111";
const ALICE_ATA = "A1iceATA111111111111111111111111111111111111";
const BOB_ATA = "BobATA11111111111111111111111111111111111111";
const RESERVE = "Reserve1111111111111111111111111111111111111";
const VAULT_1 = "Vau1t111111111111111111111111111111111111111";
const VAULT_2 = "Vau1t222222222222222222222222222222222222222";
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

describe("sibling classifiers prefer the wallet over third-party lookup-table accounts", () => {
  // Alice sends 1 SOL to Bob; in the same transaction a lookup-table vault
  // moves 5 SOL to another lookup-table vault (bigger, so it used to win).
  const withVaults = syntheticResponse({
    staticKeys: [ALICE, BOB, SYSTEM_PROGRAM],
    loaded: { writable: [VAULT_1, VAULT_2], readonly: [] },
    pre: [10n * SOL, 0n, 1n, 50n * SOL, 0n],
    post: [9n * SOL - 5000n, SOL, 1n, 45n * SOL, 5n * SOL],
    instructions: [{ programIdIndex: 2, accounts: [0, 1] }],
  });

  test("transfer: wallet pair wins over a larger vault-to-vault movement", async () => {
    const { classification } = await run(withVaults, { walletAddress: ALICE });
    expect(classification.primaryType).toBe("transfer");
    expect(classification.sender).toBe(ALICE);
    expect(classification.receiver).toBe(BOB);
  });

  test("solana-pay: wallet pair wins", async () => {
    const memoProgram = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
    const response = syntheticResponse({
      staticKeys: [ALICE, BOB, SYSTEM_PROGRAM, memoProgram],
      loaded: { writable: [VAULT_1, VAULT_2], readonly: [] },
      pre: [10n * SOL, 0n, 1n, 1n, 50n * SOL, 0n],
      post: [9n * SOL - 5000n, SOL, 1n, 1n, 45n * SOL, 5n * SOL],
      instructions: [
        { programIdIndex: 2, accounts: [0, 1] },
        { programIdIndex: 3, accounts: [] },
      ],
    });
    const { classification } = await run(response, { walletAddress: ALICE, memo: "order-42" });
    expect(classification.metadata?.payment_type).toBe("solana_pay");
    expect(classification.sender).toBe(ALICE);
    expect(classification.receiver).toBe(BOB);
  });

  test("bridge: a custody debit cannot turn the wallet's bridge_in into bridge_out", async () => {
    const { classification } = await run(
      syntheticResponse({
        staticKeys: [ALICE, SYSTEM_PROGRAM],
        loaded: { writable: [VAULT_1], readonly: [] },
        pre: [SOL, 1n, 50n * SOL],
        post: [3n * SOL - 5000n, 1n, 48n * SOL],
      }),
      { protocol: { id: "wormhole", name: "Wormhole" }, walletAddress: ALICE },
    );
    expect(classification.primaryType).toBe("bridge_in");
    expect(classification.receiver).toBe(ALICE);
  });

  test("privacy-cash: a third-party movement cannot replace the wallet's deposit", async () => {
    const { classification } = await run(withVaults, {
      protocol: { id: "privacy-cash", name: "Privacy Cash" },
      walletAddress: ALICE,
    });
    expect(classification.primaryType).toBe("privacy_deposit");
    expect(classification.sender).toBe(ALICE);
  });

  test("nft-mint: the mint price is the payer's debit, not a vault's", () => {
    const legs: TxLeg[] = [
      createMockLeg({ accountId: `external:${VAULT_1}`, side: "debit", role: "sent", amount: createSolAmount(3) }),
      createMockLeg({ accountId: `external:${ALICE}`, side: "debit", role: "sent", amount: createSolAmount(1) }),
      createMockLeg({ accountId: `external:${ALICE}`, side: "credit", role: "received", amount: createNftAmount("Cool NFT") }),
    ];
    const tx = createMockTransaction({
      protocol: { id: "candy-machine-v3", name: "Candy Machine" },
      accountKeys: [ALICE],
    });
    const result = new NftMintClassifier().classify({ legs, tx });
    expect(result?.secondaryAmount?.amountUi).toBe(1);
  });

  test("nft-transfer (marketplace): the purchase price is the wallet's debit, not a vault's", () => {
    const legs: TxLeg[] = [
      createMockLeg({ accountId: `external:${VAULT_1}`, side: "debit", role: "sent", amount: createSolAmount(3) }),
      createMockLeg({ accountId: `external:${ALICE}`, side: "debit", role: "sent", amount: createSolAmount(1) }),
      createMockLeg({ accountId: `external:${ALICE}`, side: "credit", role: "received", amount: createNftAmount("Cool NFT") }),
    ];
    const tx = createMockTransaction({
      protocol: { id: "magic-eden", name: "Magic Eden" },
      accountKeys: [ALICE],
    });
    const result = new NftTransferClassifier().classify({ legs, tx, walletAddress: ALICE });
    expect(result?.primaryType).toBe("nft_purchase");
    expect(result?.secondaryAmount?.amountUi).toBe(1);
  });
});

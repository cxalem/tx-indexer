/**
 * A debit from a token account closed in the transaction, with no credit of the
 * same mint anywhere (burn and close), is accounting only. It must not become
 * the evidence for an action and must not change an answer that was right
 * before closed-account debits became visible.
 */
import { describe, test, expect } from "bun:test";
import type { Signature } from "@solana/kit";
import type { RawTransaction } from "@tx-indexer/core/tx/tx.types";
import { fetchTransaction } from "@tx-indexer/solana/fetcher/transactions";
import { transactionToLegs } from "@tx-indexer/solana/mappers/transaction-to-legs";
import {
  JUPITER_V6_PROGRAM_ID,
  PRIVACY_CASH_PROGRAM_ID,
  PRIVACY_CASH_SPL_POOL,
  STAKE_POOL_PROGRAM_ID,
} from "@tx-indexer/solana/constants/program-ids";
import { classifyTransaction } from "../../engine/classification-service";
import { unmatchedClosedAccountDebits } from "../../engine/leg-helpers";
import {
  SOL,
  mockRpc,
  syntheticResponse,
  TOKEN_PROGRAM,
  type SyntheticTxInput,
} from "@tx-indexer/solana/__fixtures__/synthetic";

const SIG = "C1osedDebits1111111111111111111111111111111111111111111111111111111111111111111111111" as Signature;
const ALICE = "A1ice11111111111111111111111111111111111111";
const BOB = "Bob1111111111111111111111111111111111111111";
const CAROL = "Caro1111111111111111111111111111111111111111";
const DAVE = "Dave1111111111111111111111111111111111111111";
const SPONSOR = "Sponsor111111111111111111111111111111111111";
const A_USDC = "A1iceUSDC11111111111111111111111111111111111";
const B_USDC = "BobUSDC111111111111111111111111111111111111";
const C_USDC = "CaroUSDC11111111111111111111111111111111111";
const D_USDC = "DaveUSDC11111111111111111111111111111111111";
const A_POS = "A1icePos111111111111111111111111111111111111";
const B_POS = "BobPos1111111111111111111111111111111111111";
const A_JUNK = "A1iceJunk1111111111111111111111111111111111";
const A_POOL = "A1icePoo1ATA1111111111111111111111111111111";
const A_X = "A1iceX11111111111111111111111111111111111111";
const RESERVE = "Reserve1111111111111111111111111111111111111";
const VAULT = "Poo1Vau1t111111111111111111111111111111111";
const POOL_OWNER = "Poo1Owner11111111111111111111111111111111";
const POOL_USDC = "Poo1USDC1111111111111111111111111111111111";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const POS = "PosNFT11111111111111111111111111111111111111";
const JUNK = "Junk111111111111111111111111111111111111111";
const X = "XMint111111111111111111111111111111111111111";
const POOL_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";
const RENT = 2039280n;

const tb = (accountIndex: number, mint: string, owner: string, amount: bigint, decimals: number) => ({
  accountIndex,
  mint,
  owner,
  amount,
  decimals,
});

async function classify(input: SyntheticTxInput, walletAddress: string, protocol: RawTransaction["protocol"] = null) {
  const { rpc } = mockRpc(() => syntheticResponse(input));
  const tx = (await fetchTransaction(rpc, SIG))!;
  tx.protocol = protocol;
  const legs = transactionToLegs(tx, walletAddress);
  return { tx, legs, c: classifyTransaction(legs, tx, walletAddress) };
}

/** Alice sends 10 USDC to Bob and burns and closes a zero-decimal position token. */
const usdcPlusBurnedPosition = (rentTo: "alice" | "sponsor"): SyntheticTxInput =>
  rentTo === "alice"
    ? {
        staticKeys: [ALICE, A_USDC, B_USDC, A_POS, TOKEN_PROGRAM],
        pre: [SOL, RENT, RENT, RENT, 1n],
        post: [SOL + RENT - 5000n, RENT, RENT, 0n, 1n],
        instructions: [{ programIdIndex: 4, accounts: [1, 2, 0] }],
        preTokenBalances: [tb(1, USDC, ALICE, 50_000_000n, 6), tb(2, USDC, BOB, 0n, 6), tb(3, POS, ALICE, 1n, 0)],
        postTokenBalances: [tb(1, USDC, ALICE, 40_000_000n, 6), tb(2, USDC, BOB, 10_000_000n, 6)],
      }
    : {
        staticKeys: [SPONSOR, ALICE, A_USDC, B_USDC, A_POS, TOKEN_PROGRAM],
        pre: [SOL, SOL, RENT, RENT, RENT, 1n],
        post: [SOL + RENT - 5000n, SOL, RENT, RENT, 0n, 1n],
        instructions: [{ programIdIndex: 5, accounts: [2, 3, 1] }],
        preTokenBalances: [tb(2, USDC, ALICE, 50_000_000n, 6), tb(3, USDC, BOB, 0n, 6), tb(4, POS, ALICE, 1n, 0)],
        postTokenBalances: [tb(2, USDC, ALICE, 40_000_000n, 6), tb(3, USDC, BOB, 10_000_000n, 6)],
      };

describe("NFT transfer: a burned/closed zero-decimal debit with no same-mint credit is not a send", () => {
  test("repro: Bob's perspective is the USDC transfer Alice -> Bob (as before), not nft_send", async () => {
    const { legs, tx, c } = await classify(usdcPlusBurnedPosition("alice"), BOB);
    // the accounting debit is kept
    expect(legs.some((l) => l.side === "debit" && l.amount.token.mint === POS && l.accountId === `external:${ALICE}`)).toBe(true);
    expect([...unmatchedClosedAccountDebits(legs, tx)].map((l) => l.amount.token.mint)).toEqual([POS]);
    expect(c.primaryType).toBe("transfer");
    expect(c.primaryAmount?.amountRaw).toBe("10000000");
    expect(c.primaryAmount?.token.mint).toBe(USDC);
    expect(c.sender).toBe(ALICE);
    expect(c.receiver).toBe(BOB);
  });

  test("repro: Alice's perspective is not nft_send; with rent to a sponsor it is the USDC transfer", async () => {
    const sponsored = await classify(usdcPlusBurnedPosition("sponsor"), ALICE);
    expect(sponsored.c.primaryType).toBe("transfer");
    expect(sponsored.c.primaryAmount?.amountRaw).toBe("10000000");
    expect(sponsored.c.sender).toBe(ALICE);
    expect(sponsored.c.receiver).toBe(BOB);
    // With the close's rent refunded to Alice herself, the answer is the same as before
    // closed-account debits were visible: a `swap` of 10 USDC for the rent SOL (the rent
    // refund read as swap input is an existing limitation, not caused by the burned NFT).
    const rentToAlice = await classify(usdcPlusBurnedPosition("alice"), ALICE);
    expect(rentToAlice.c.primaryType).toBe("swap");
    expect(rentToAlice.c.primaryAmount?.token.mint).toBe(USDC);
    expect(rentToAlice.c.secondaryAmount?.amountRaw).toBe((RENT - 5000n).toString());
  });

  test("burn and close of a zero-decimal token alone is not nft_send (it is the rent movement, as before)", async () => {
    const { c } = await classify(
      {
        staticKeys: [ALICE, A_POS, TOKEN_PROGRAM],
        pre: [SOL, RENT, 1n],
        post: [SOL + RENT - 5000n, 0n, 1n],
        instructions: [{ programIdIndex: 2, accounts: [1, 0] }],
        preTokenBalances: [tb(1, POS, ALICE, 1n, 0)],
        postTokenBalances: [],
      },
      ALICE,
    );
    expect(c.primaryType).not.toBe("nft_send");
    expect(c.primaryType).toBe("transfer");
    expect(c.primaryAmount?.amountRaw).toBe(RENT.toString());
  });

  const genuineSend: SyntheticTxInput = {
    staticKeys: [ALICE, A_POS, B_POS, TOKEN_PROGRAM],
    pre: [SOL, RENT, 0n, 1n],
    post: [SOL - 5000n, 0n, RENT, 1n],
    instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
    preTokenBalances: [tb(1, POS, ALICE, 1n, 0)],
    postTokenBalances: [tb(2, POS, BOB, 1n, 0)],
  };

  test("a genuine NFT send whose sender account is closed is still nft_send / nft_receive", async () => {
    const sender = await classify(genuineSend, ALICE);
    expect(sender.c.primaryType).toBe("nft_send");
    expect(sender.c.sender).toBe(ALICE);
    expect(sender.c.receiver).toBe(BOB);
    const receiver = await classify(genuineSend, BOB);
    expect(receiver.c.primaryType).toBe("nft_receive");
    expect(receiver.c.sender).toBe(ALICE);
    expect(receiver.c.receiver).toBe(BOB);
  });

  test("an unrelated recipient is unaffected when someone else's NFT account is closed", async () => {
    const input: SyntheticTxInput = {
      staticKeys: [DAVE, ALICE, D_USDC, C_USDC, A_POS, TOKEN_PROGRAM],
      pre: [SOL, SOL, RENT, RENT, RENT, 1n],
      post: [SOL - 5000n, SOL + RENT, RENT, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 5, accounts: [2, 3, 0] }],
      preTokenBalances: [tb(2, USDC, DAVE, 9_000_000n, 6), tb(3, USDC, CAROL, 0n, 6), tb(4, POS, ALICE, 1n, 0)],
      postTokenBalances: [tb(2, USDC, DAVE, 4_000_000n, 6), tb(3, USDC, CAROL, 5_000_000n, 6)],
    };
    for (const wallet of [CAROL, DAVE]) {
      const { c } = await classify(input, wallet);
      expect(c.primaryType).toBe("transfer");
      expect(c.primaryAmount?.amountRaw).toBe("5000000");
      expect(c.sender).toBe(DAVE);
      expect(c.receiver).toBe(CAROL);
    }
  });
});

describe("sibling classifiers ignore unmatched closed-account debits", () => {
  test("swap: receiving 10 USDC while burning and closing 1,000 JUNK stays a transfer, not a JUNK -> USDC swap", async () => {
    const { c } = await classify(
      {
        staticKeys: [BOB, ALICE, B_USDC, A_USDC, A_JUNK, TOKEN_PROGRAM],
        pre: [SOL, SOL, RENT, RENT, RENT, 1n],
        post: [SOL - 5000n, SOL + RENT, RENT, RENT, 0n, 1n],
        instructions: [{ programIdIndex: 5, accounts: [2, 3, 0] }],
        preTokenBalances: [tb(2, USDC, BOB, 50_000_000n, 6), tb(3, USDC, ALICE, 0n, 6), tb(4, JUNK, ALICE, 1_000_000_000n, 6)],
        postTokenBalances: [tb(2, USDC, BOB, 40_000_000n, 6), tb(3, USDC, ALICE, 10_000_000n, 6)],
      },
      ALICE,
    );
    expect(c.primaryType).toBe("transfer");
    expect(c.sender).toBe(BOB);
    expect(c.receiver).toBe(ALICE);
    expect(c.primaryAmount?.amountRaw).toBe("10000000");
  });

  test("swap: burn and close of a fungible token with rent to the owner is not a token -> SOL swap", async () => {
    const { c } = await classify(
      {
        staticKeys: [ALICE, A_JUNK, TOKEN_PROGRAM],
        pre: [SOL, RENT, 1n],
        post: [SOL + RENT - 5000n, 0n, 1n],
        instructions: [{ programIdIndex: 2, accounts: [1, 0] }],
        preTokenBalances: [tb(1, JUNK, ALICE, 1_000_000_000n, 6)],
        postTokenBalances: [],
      },
      ALICE,
    );
    expect(c.primaryType).not.toBe("swap");
  });

  test("stake: a sponsored deposit stays a deposit when the wallet also burns and closes another token", async () => {
    const { c } = await classify(
      {
        staticKeys: [BOB, ALICE, A_POOL, RESERVE, A_JUNK, STAKE_POOL_PROGRAM_ID],
        pre: [10n * SOL, SOL, RENT, 100n * SOL, RENT, 1n],
        post: [9n * SOL - 5000n, SOL, RENT, 101n * SOL, RENT, 1n],
        instructions: [{ programIdIndex: 5, accounts: [0, 2, 3] }],
        preTokenBalances: [tb(2, POOL_MINT, ALICE, 0n, 9), tb(4, JUNK, ALICE, 1_000_000_000n, 6)],
        postTokenBalances: [tb(2, POOL_MINT, ALICE, 900_000_000n, 9)],
      },
      ALICE,
      { id: "stake-pool", name: "Stake Pool Program" },
    );
    expect(c.primaryType).toBe("stake_deposit");
    expect(c.sender).toBe(BOB);
  });

  test("privacy cash: the shielded USDC stays the deposit, not the burned JUNK", async () => {
    const { c } = await classify(
      {
        staticKeys: [ALICE, PRIVACY_CASH_SPL_POOL, POOL_USDC, A_USDC, A_JUNK, PRIVACY_CASH_PROGRAM_ID],
        pre: [SOL, SOL, RENT, RENT, RENT, 1n],
        post: [SOL + RENT - 5000n, SOL, RENT, RENT, 0n, 1n],
        instructions: [{ programIdIndex: 5, accounts: [3, 2, 0] }],
        preTokenBalances: [tb(2, USDC, PRIVACY_CASH_SPL_POOL, 0n, 6), tb(3, USDC, ALICE, 50_000_000n, 6), tb(4, JUNK, ALICE, 1_000_000_000n, 6)],
        postTokenBalances: [tb(2, USDC, PRIVACY_CASH_SPL_POOL, 10_000_000n, 6), tb(3, USDC, ALICE, 40_000_000n, 6)],
      },
      ALICE,
      { id: "privacy-cash", name: "Privacy Cash" },
    );
    expect(c.primaryType).toBe("privacy_deposit");
    expect(c.primaryAmount?.token.mint).toBe(USDC);
    expect(c.primaryAmount?.amountRaw).toBe("10000000");
  });

  test("airdrop on a DEX program: receiving X while burning and closing JUNK stays an airdrop, not a JUNK -> X swap", async () => {
    const { c } = await classify(
      {
        staticKeys: [ALICE, VAULT, A_X, A_JUNK, JUPITER_V6_PROGRAM_ID],
        pre: [SOL, RENT, RENT, RENT, 1n],
        post: [SOL + RENT - 5000n, RENT, RENT, 0n, 1n],
        instructions: [{ programIdIndex: 4, accounts: [1, 2, 0] }],
        preTokenBalances: [tb(1, X, POOL_OWNER, 50_000_000n, 6), tb(2, X, ALICE, 0n, 6), tb(3, JUNK, ALICE, 1_000_000_000n, 6)],
        postTokenBalances: [tb(1, X, POOL_OWNER, 45_000_000n, 6), tb(2, X, ALICE, 5_000_000n, 6)],
      },
      ALICE,
      { id: "jupiter", name: "Jupiter" },
    );
    expect(c.primaryType).toBe("airdrop");
    expect(c.primaryAmount?.token.mint).toBe(X);
  });

  test("a sell that closes the account is still a swap: the pool vault is credited the same mint", async () => {
    const { tx, legs, c } = await classify(
      {
        staticKeys: [ALICE, VAULT, A_JUNK, JUPITER_V6_PROGRAM_ID],
        pre: [10n * SOL, 50n * SOL, RENT, 1n],
        post: [11n * SOL + RENT - 5000n, 49n * SOL, 0n, 1n],
        instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
        preTokenBalances: [tb(1, JUNK, POOL_OWNER, 0n, 6), tb(2, JUNK, ALICE, 1_000_000_000n, 6)],
        postTokenBalances: [tb(1, JUNK, POOL_OWNER, 1_000_000_000n, 6)],
      },
      ALICE,
      { id: "jupiter", name: "Jupiter" },
    );
    expect(unmatchedClosedAccountDebits(legs, tx).size).toBe(0);
    expect(c.primaryType).toBe("swap");
    expect(c.primaryAmount?.token.mint).toBe(JUNK);
    expect(c.primaryAmount?.amountRaw).toBe("1000000000");
  });
});

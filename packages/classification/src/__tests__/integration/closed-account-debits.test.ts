/**
 * Closed-account debits through the routed pipeline (truthful legs for swap and transfer,
 * the "v1-main" legs for every other classifier). Legacy classifiers must answer as at
 * 3111fd7 (proven case by case in packages/sdk/src/legacy-input.test.ts); swap must not
 * use a burned-and-closed debit as evidence; transfer only pairs the wallet's own transfers.
 */
import { describe, test, expect } from "bun:test";
import type { Signature } from "@solana/kit";
import type { RawTransaction } from "@tx-indexer/core/tx/tx.types";
import { fetchTransaction } from "@tx-indexer/solana/fetcher/transactions";
import { transactionToLegInputs } from "@tx-indexer/solana/mappers/leg-inputs";
import {
  JUPITER_V6_PROGRAM_ID,
  PRIVACY_CASH_PROGRAM_ID,
  PRIVACY_CASH_SPL_POOL,
  STAKE_POOL_PROGRAM_ID,
  WORMHOLE_TOKEN_BRIDGE_ID,
  MAGIC_EDEN_V2_PROGRAM_ID,
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
const W = "WrappedW1111111111111111111111111111111111";
const A_W = "A1iceW11111111111111111111111111111111111111";
const B_W = "A1iceWB1111111111111111111111111111111111111";
const B_POS2 = "A1icePosB111111111111111111111111111111111";

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
  // The routed pipeline, as the SDK runs it: truthful legs for migrated classifiers,
  // the "v1-main" view for the others.
  const inputs = transactionToLegInputs(tx, walletAddress);
  const legs = inputs["v2-closed-token-accounts"];
  return { tx, legs, c: classifyTransaction(legs, tx, walletAddress, { legacyLegs: inputs["v1-main"] }) };
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
    expect([...unmatchedClosedAccountDebits(legs)].map((l) => l.amount.token.mint)).toEqual([POS]);
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

  test("a genuine NFT send whose sender account is closed: nft-transfer is not migrated, so the answer is 3111fd7's", async () => {
    // At 3111fd7 the closed sender account's debit is invisible: both wallets see an
    // nft_receive with no sender. The legacy classifier keeps that until it is migrated.
    for (const wallet of [ALICE, BOB]) {
      const { c } = await classify(genuineSend, wallet);
      expect(c.primaryType).toBe("nft_receive");
      expect(c.sender).toBeNull();
      expect(c.receiver).toBe(BOB);
    }
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
        // JUNK account closed: zero lamports after, its rent refunded to the sponsor
        post: [9n * SOL - 5000n + RENT, SOL, RENT, 101n * SOL, 0n, 1n],
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
    expect(unmatchedClosedAccountDebits(legs).size).toBe(0);
    expect(c.primaryType).toBe("swap");
    expect(c.primaryAmount?.token.mint).toBe(JUNK);
    expect(c.primaryAmount?.amountRaw).toBe("1000000000");
  });
});

describe("only a proven closure is excluded, identified by its own token account", () => {
  /** Alice burns 10 W through Wormhole from A (stays open, zero balance) and closes B of W; B's rent goes to a sponsor. */
  const wormhole = (bPre: bigint): SyntheticTxInput => ({
    staticKeys: [SPONSOR, ALICE, A_W, B_W, WORMHOLE_TOKEN_BRIDGE_ID],
    pre: [SOL, SOL, RENT, RENT, 1n],
    post: [SOL - 5000n + RENT, SOL, RENT, 0n, 1n],
    instructions: [{ programIdIndex: 4, accounts: [2, 3, 1] }],
    preTokenBalances: [tb(2, W, ALICE, 1_000_000_000n, 8), tb(3, W, ALICE, bPre, 8)],
    postTokenBalances: [tb(2, W, ALICE, 0n, 8)],
  });

  test("Wormhole burn from an open account beside a closed EMPTY sibling: bridge_out of the 10 tokens, as before", async () => {
    const { legs, c } = await classify(wormhole(0n), ALICE, { id: "wormhole-token-bridge", name: "Wormhole Token Bridge" });
    expect(unmatchedClosedAccountDebits(legs).size).toBe(0);
    expect(c.primaryType).toBe("bridge_out");
    expect(c.primaryAmount?.token.mint).toBe(W);
    expect(c.primaryAmount?.amountRaw).toBe("1000000000");
    expect(c.sender).toBe(ALICE);
  });

  test("same, with the closed sibling holding tokens: still bridge_out of the 10 tokens from Alice", async () => {
    const { legs, c } = await classify(wormhole(500_000_000n), ALICE, { id: "wormhole-token-bridge", name: "Wormhole Token Bridge" });
    // only the closed sibling's debit is an unmatched closed-account debit
    expect([...unmatchedClosedAccountDebits(legs)].map((l) => [l.closedTokenAccount, l.amount.amountRaw])).toEqual([[B_W, "500000000"]]);
    expect(c.primaryType).toBe("bridge_out");
    expect(c.primaryAmount?.token.mint).toBe(W);
    expect(c.primaryAmount?.amountRaw).toBe("1000000000");
    expect(c.sender).toBe(ALICE);
  });

  test("swap: the debit of an account that goes to zero but stays open is kept beside a closed sibling of the same owner and mint", async () => {
    const { legs, c } = await classify(
      {
        staticKeys: [ALICE, A_W, B_W, A_USDC, POOL_USDC, JUPITER_V6_PROGRAM_ID],
        pre: [SOL, RENT, RENT, RENT, RENT, 1n],
        post: [SOL - 5000n + RENT, RENT, 0n, RENT, RENT, 1n],
        instructions: [{ programIdIndex: 5, accounts: [1, 2, 3, 4, 0] }],
        preTokenBalances: [
          tb(1, W, ALICE, 1_000_000_000n, 8),
          tb(2, W, ALICE, 300_000_000n, 8),
          tb(3, USDC, ALICE, 0n, 6),
          tb(4, USDC, POOL_OWNER, 50_000_000n, 6),
        ],
        postTokenBalances: [tb(1, W, ALICE, 0n, 8), tb(3, USDC, ALICE, 5_000_000n, 6), tb(4, USDC, POOL_OWNER, 45_000_000n, 6)],
      },
      ALICE,
      { id: "jupiter", name: "Jupiter" },
    );
    expect([...unmatchedClosedAccountDebits(legs)].map((l) => l.closedTokenAccount)).toEqual([B_W]);
    expect(c.primaryType).toBe("swap");
    expect(c.primaryAmount?.token.mint).toBe(W);
    expect(c.primaryAmount?.amountRaw).toBe("1000000000");
    expect(c.secondaryAmount?.token.mint).toBe(USDC);
  });

  test("nft: a send from an account that stays open is kept beside a burned and closed sibling of the same mint", async () => {
    const { c } = await classify(
      {
        staticKeys: [ALICE, A_POS, B_POS2, TOKEN_PROGRAM],
        pre: [SOL, RENT, RENT, 1n],
        post: [SOL - 5000n + RENT, RENT, 0n, 1n],
        instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
        preTokenBalances: [tb(1, POS, ALICE, 1n, 0), tb(2, POS, ALICE, 1n, 0)],
        postTokenBalances: [tb(1, POS, ALICE, 0n, 0)],
      },
      ALICE,
    );
    expect(c.primaryType).toBe("nft_send");
    expect(c.sender).toBe(ALICE);
    expect(c.metadata?.quantity).toBe(1);
  });

  test("a burn whose account keeps its lamports is not a proven closure: its debit stays evidence (as before)", async () => {
    const { legs } = await classify(
      {
        staticKeys: [ALICE, A_JUNK, TOKEN_PROGRAM],
        pre: [SOL, RENT, 1n],
        post: [SOL - 5000n, RENT, 1n],
        instructions: [{ programIdIndex: 2, accounts: [1, 0] }],
        preTokenBalances: [tb(1, JUNK, ALICE, 1_000_000_000n, 6)],
        postTokenBalances: [],
      },
      ALICE,
    );
    expect(legs.some((l) => l.side === "debit" && l.amount.token.mint === JUNK)).toBe(true);
    expect(unmatchedClosedAccountDebits(legs).size).toBe(0);
  });

  test("hand-built legs without provenance are never excluded", () => {
    const leg = {
      accountId: `external:${ALICE}`,
      side: "debit" as const,
      role: "sent" as const,
      amount: { token: { mint: JUNK, symbol: "JUNK", decimals: 6 }, amountRaw: "1", amountUi: 0.000001 },
    };
    expect(unmatchedClosedAccountDebits([leg]).size).toBe(0);
    expect(unmatchedClosedAccountDebits([{ ...leg, closedTokenAccount: A_JUNK }]).size).toBe(1);
  });
});

describe("marketplace sale where the seller's NFT account closes", () => {
  /** Bob buys Alice's NFT for 2 SOL on Magic Eden; Alice's NFT account closes and its rent returns to her. */
  const sale: SyntheticTxInput = {
    staticKeys: [BOB, ALICE, A_POS, B_POS, MAGIC_EDEN_V2_PROGRAM_ID],
    pre: [10n * SOL, SOL, RENT, 0n, 1n],
    post: [8n * SOL - 5000n - RENT, 3n * SOL + RENT, 0n, RENT, 1n],
    instructions: [{ programIdIndex: 4, accounts: [2, 3, 0, 1] }],
    preTokenBalances: [tb(2, POS, ALICE, 1n, 0)],
    postTokenBalances: [tb(3, POS, BOB, 1n, 0)],
  };
  const ME = { id: "magic-eden", name: "Magic Eden" };

  test("seller: nft_sale with the buyer as receiver (as before the closed debit was visible)", async () => {
    const { c } = await classify(sale, ALICE, ME);
    expect(c.primaryType).toBe("nft_sale");
    expect(c.primaryAmount?.token.mint).toBe(POS);
    expect(c.sender).toBe(ALICE);
    expect(c.receiver).toBe(BOB);
  });

  test("buyer: nft_purchase, unchanged", async () => {
    const { c } = await classify(sale, BOB, ME);
    expect(c.primaryType).toBe("nft_purchase");
    expect(c.receiver).toBe(BOB);
  });
});

describe("swap risks with closed-account debits (migrated classifier)", () => {
  const C_JUNK = "CaroJunk11111111111111111111111111111111111";
  const VAULT_W = "Poo1VaultW11111111111111111111111111111111";

  test("an unrelated credit of the same mint does not let a burned debit become a swap input", async () => {
    // Bob sends Alice 10 USDC; Alice burns and closes 1,000 JUNK; Carol is minted 5 JUNK.
    const { legs, c } = await classify(
      {
        staticKeys: [BOB, ALICE, B_USDC, A_USDC, A_JUNK, C_JUNK, TOKEN_PROGRAM],
        pre: [SOL, SOL, RENT, RENT, RENT, RENT, 1n],
        post: [SOL - 5000n, SOL + RENT, RENT, RENT, 0n, RENT, 1n],
        instructions: [{ programIdIndex: 6, accounts: [2, 3, 0] }],
        preTokenBalances: [tb(2, USDC, BOB, 50_000_000n, 6), tb(3, USDC, ALICE, 0n, 6), tb(4, JUNK, ALICE, 1_000_000_000n, 6), tb(5, JUNK, CAROL, 0n, 6)],
        postTokenBalances: [tb(2, USDC, BOB, 40_000_000n, 6), tb(3, USDC, ALICE, 10_000_000n, 6), tb(5, JUNK, CAROL, 5_000_000n, 6)],
      },
      ALICE,
    );
    expect([...unmatchedClosedAccountDebits(legs)].map((l) => l.closedTokenAccount)).toEqual([A_JUNK]);
    // 3111fd7: transfer of 10 USDC Bob -> Alice
    expect(c.primaryType).toBe("transfer");
    expect(c.primaryAmount?.amountRaw).toBe("10000000");
    expect(c.sender).toBe(BOB);
    expect(c.receiver).toBe(ALICE);
  });

  test("a burned closed sibling larger than the sale does not change the swap amount", async () => {
    // Alice sells 10 W from open A to the vault for 5 USDC and burns and closes sibling B (30 W).
    const { c } = await classify(
      {
        staticKeys: [ALICE, A_W, B_W, VAULT_W, A_USDC, POOL_USDC, JUPITER_V6_PROGRAM_ID],
        pre: [SOL, RENT, RENT, RENT, RENT, RENT, 1n],
        post: [SOL - 5000n + RENT, RENT, 0n, RENT, RENT, RENT, 1n],
        instructions: [{ programIdIndex: 6, accounts: [1, 2, 3, 4, 5, 0] }],
        preTokenBalances: [
          tb(1, W, ALICE, 1_000_000_000n, 8),
          tb(2, W, ALICE, 3_000_000_000n, 8),
          tb(3, W, POOL_OWNER, 0n, 8),
          tb(4, USDC, ALICE, 0n, 6),
          tb(5, USDC, POOL_OWNER, 50_000_000n, 6),
        ],
        postTokenBalances: [tb(1, W, ALICE, 0n, 8), tb(3, W, POOL_OWNER, 1_000_000_000n, 8), tb(4, USDC, ALICE, 5_000_000n, 6), tb(5, USDC, POOL_OWNER, 45_000_000n, 6)],
      },
      ALICE,
    );
    // 3111fd7: swap 10 W -> 5 USDC
    expect(c.primaryType).toBe("swap");
    expect(c.primaryAmount?.token.mint).toBe(W);
    expect(c.primaryAmount?.amountRaw).toBe("1000000000");
    expect(c.secondaryAmount?.amountRaw).toBe("5000000");
  });

  test("a sell whose closed account's whole balance reaches the vault is still a swap of that amount", async () => {
    const { legs, c } = await classify(
      {
        staticKeys: [ALICE, VAULT, A_JUNK, JUPITER_V6_PROGRAM_ID],
        pre: [10n * SOL, 50n * SOL, RENT, 1n],
        post: [11n * SOL + RENT - 5000n, 49n * SOL, 0n, 1n],
        instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
        preTokenBalances: [tb(1, JUNK, POOL_OWNER, 0n, 6), tb(2, JUNK, ALICE, 1_000_000_000n, 6)],
        postTokenBalances: [tb(1, JUNK, POOL_OWNER, 1_000_000_000n, 6)],
      },
      ALICE,
    );
    expect(unmatchedClosedAccountDebits(legs).size).toBe(0);
    expect(c.primaryType).toBe("swap");
    expect(c.primaryAmount?.amountRaw).toBe("1000000000");
  });
});

describe("transfer: the wallet's own transfer only", () => {
  test("a wallet that only receives rent is not given another wallet's token transfer", async () => {
    const DAVE_CLOSED = "DaveC1osed111111111111111111111111111111111";
    const input: SyntheticTxInput = {
      staticKeys: [DAVE, ALICE, D_USDC, C_USDC, DAVE_CLOSED, TOKEN_PROGRAM],
      pre: [SOL, SOL, RENT, RENT, RENT, 1n],
      post: [SOL - 5000n, SOL + RENT, RENT, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 5, accounts: [2, 3, 0] }],
      preTokenBalances: [tb(2, USDC, DAVE, 9_000_000n, 6), tb(3, USDC, CAROL, 0n, 6)],
      postTokenBalances: [tb(2, USDC, DAVE, 4_000_000n, 6), tb(3, USDC, CAROL, 5_000_000n, 6)],
    };
    const alice = await classify(input, ALICE);
    expect(alice.c.primaryType).toBe("transfer");
    expect(alice.c.receiver).toBe(ALICE);
    expect(alice.c.primaryAmount?.amountRaw).toBe(RENT.toString());
    const carol = await classify(input, CAROL);
    expect([carol.c.sender, carol.c.receiver, carol.c.primaryAmount?.amountRaw]).toEqual([DAVE, CAROL, "5000000"]);
  });
});

/**
 * Corpus for the "v1-main" compatibility oracle (see generate-oracle.ts and
 * ../../legacy-input.test.ts).
 *
 * Three sources, each replayed once per perspective:
 * - every recorded mainnet fixture in packages/solana/src/__fixtures__/mainnet
 *   (perspectives: none, fee payer);
 * - every accuracy case (accuracy/cases/<id>/rpc.json), with its labelled perspectives;
 * - synthetic transactions below: closures, owner change, mint change, missing owners,
 *   missing snapshots, raw/UI sign disagreement, wSOL, DEX tagging, several perspectives,
 *   and the review counterexamples.
 *
 * Only data lives here. The generator runs the 3111fd7 tree on it; the test runs this tree.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  SOL,
  TOKEN_PROGRAM,
  WSOL_MINT,
  syntheticResponse,
  type SyntheticTxInput,
} from "@tx-indexer/solana/__fixtures__/synthetic";
import {
  JUPITER_V6_PROGRAM_ID,
  MAGIC_EDEN_V2_PROGRAM_ID,
  PRIVACY_CASH_PROGRAM_ID,
  PRIVACY_CASH_SPL_POOL,
  STAKE_POOL_PROGRAM_ID,
  WORMHOLE_TOKEN_BRIDGE_ID,
} from "@tx-indexer/solana/constants/program-ids";

const REPO = join(import.meta.dir, "../../../../..");

export const SYNTHETIC_SIGNATURE =
  "Sweep1111111111111111111111111111111111111111111111111111111111111111111111111111111111";

export type Perspective = string | null;

export interface BodyItem {
  id: string;
  kind: "body";
  signature: string;
  /** Verbatim JSON-RPC response body */
  body: string;
  perspectives: Perspective[];
}

export interface SyntheticItem {
  id: string;
  kind: "synthetic";
  input: SyntheticTxInput;
  /** Edits the response the synthetic builder cannot express (missing owners, snapshots, UI strings). */
  mutate?: (response: { meta: Record<string, unknown> }) => void;
  perspectives: Perspective[];
}

export type CorpusItem = BodyItem | SyntheticItem;

/** Builds the synthetic response for an item (fresh object each call). */
export function syntheticResponseFor(item: SyntheticItem): unknown {
  const response = syntheticResponse(item.input) as unknown as { meta: Record<string, unknown> };
  item.mutate?.(response);
  return response;
}

const ALICE = "A1ice11111111111111111111111111111111111111";
const BOB = "Bob1111111111111111111111111111111111111111";
const CAROL = "Caro1111111111111111111111111111111111111111";
const DAVE = "Dave1111111111111111111111111111111111111111";
const SPONSOR = "Sponsor111111111111111111111111111111111111";
const ROYALTY = "Roya1ty111111111111111111111111111111111111";
const ESCROW = "Escrow11111111111111111111111111111111111111";
const POOL_OWNER = "Poo1Owner11111111111111111111111111111111";
const CUSTODY = "Custody11111111111111111111111111111111111";
const A_ATA = "A1iceATA111111111111111111111111111111111111";
const B_ATA = "BobATA11111111111111111111111111111111111111";
const A_USDC = "A1iceUSDC11111111111111111111111111111111111";
const B_USDC = "BobUSDC111111111111111111111111111111111111";
const C_USDC = "CaroUSDC11111111111111111111111111111111111";
const D_USDC = "DaveUSDC11111111111111111111111111111111111";
const A_POS = "A1icePos111111111111111111111111111111111111";
const A_POS2 = "A1icePosB111111111111111111111111111111111";
const B_POS = "BobPos1111111111111111111111111111111111111";
const ESCROW_POS = "EscrowPos1111111111111111111111111111111111";
const A_JUNK = "A1iceJunk1111111111111111111111111111111111";
const C_JUNK = "CaroJunk11111111111111111111111111111111111";
const A_JNFT = "A1iceJnft1111111111111111111111111111111111";
const A_W = "A1iceW11111111111111111111111111111111111111";
const B_W = "A1iceWB1111111111111111111111111111111111111";
const A_X = "A1iceX11111111111111111111111111111111111111";
const A_POOL = "A1icePoo1ATA1111111111111111111111111111111";
const A_WSOL = "A1iceWso11111111111111111111111111111111111";
const RESERVE = "Reserve1111111111111111111111111111111111111";
const VAULT = "Poo1Vau1t111111111111111111111111111111111";
const VAULT_W = "Poo1VaultW11111111111111111111111111111111";
const POOL_USDC = "Poo1USDC1111111111111111111111111111111111";
const CUST_W = "CustW111111111111111111111111111111111111111";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const POS = "PosNFT11111111111111111111111111111111111111";
const JNFT = "JunkNFT1111111111111111111111111111111111111";
const JUNK = "Junk111111111111111111111111111111111111111";
const MINT_A = "MintA11111111111111111111111111111111111111";
const MINT_B = "MintB11111111111111111111111111111111111111";
const W = "WrappedW1111111111111111111111111111111111";
const X = "XMint111111111111111111111111111111111111111";
const POOL_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";
const RENT = 2_039_280n;

const tb = (accountIndex: number, mint: string, owner: string, amount: bigint, decimals: number) => ({
  accountIndex,
  mint,
  owner,
  amount,
  decimals,
});

type Meta = Record<string, unknown>;
type Bal = { owner?: string; uiTokenAmount: { amount: string; uiAmountString: string } };
const balances = (r: { meta: Meta }, key: "preTokenBalances" | "postTokenBalances") => r.meta[key] as Bal[];

/** Alice sells all of MINT_A (A_ATA) to Bob and closes the account; rent back to her. */
const closeSell: SyntheticTxInput = {
  staticKeys: [ALICE, A_ATA, B_ATA, TOKEN_PROGRAM],
  pre: [SOL, RENT, RENT, 1n],
  post: [SOL + RENT - 5000n, 0n, RENT, 1n],
  instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
  preTokenBalances: [tb(1, MINT_A, ALICE, 750_000n, 6), tb(2, MINT_A, BOB, 0n, 6)],
  postTokenBalances: [tb(2, MINT_A, BOB, 750_000n, 6)],
};

/** Alice sends 10 USDC to Bob and burns and closes a zero-decimal position token (rent to Alice). */
const usdcPlusBurnedPosition: SyntheticTxInput = {
  staticKeys: [ALICE, A_USDC, B_USDC, A_POS, TOKEN_PROGRAM],
  pre: [SOL, RENT, RENT, RENT, 1n],
  post: [SOL + RENT - 5000n, RENT, RENT, 0n, 1n],
  instructions: [{ programIdIndex: 4, accounts: [1, 2, 0] }],
  preTokenBalances: [tb(1, USDC, ALICE, 50_000_000n, 6), tb(2, USDC, BOB, 0n, 6), tb(3, POS, ALICE, 1n, 0)],
  postTokenBalances: [tb(1, USDC, ALICE, 40_000_000n, 6), tb(2, USDC, BOB, 10_000_000n, 6)],
};

const wormholeSibling = (bPre: bigint): SyntheticTxInput => ({
  staticKeys: [SPONSOR, ALICE, A_W, B_W, WORMHOLE_TOKEN_BRIDGE_ID],
  pre: [SOL, SOL, RENT, RENT, 1n],
  post: [SOL - 5000n + RENT, SOL, RENT, 0n, 1n],
  instructions: [{ programIdIndex: 4, accounts: [2, 3, 1] }],
  preTokenBalances: [tb(2, W, ALICE, 1_000_000_000n, 8), tb(3, W, ALICE, bPre, 8)],
  postTokenBalances: [tb(2, W, ALICE, 0n, 8)],
});

export const SYNTHETIC: SyntheticItem[] = [
  // --- mapper coverage -------------------------------------------------------------
  { id: "close-sell", kind: "synthetic", input: closeSell, perspectives: [ALICE, BOB, null] },
  {
    id: "close-sell-no-owner-on-closed-entry",
    kind: "synthetic",
    input: closeSell,
    mutate: (r) => {
      delete balances(r, "preTokenBalances")[0]!.owner;
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "post-entry-without-owner",
    kind: "synthetic",
    input: closeSell,
    mutate: (r) => {
      delete balances(r, "postTokenBalances")[0]!.owner;
      delete balances(r, "preTokenBalances")[1]!.owner;
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "owner-change",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, A_ATA, TOKEN_PROGRAM],
      pre: [SOL, RENT, 1n],
      post: [SOL - 5000n, RENT, 1n],
      instructions: [{ programIdIndex: 2, accounts: [1, 0] }],
      preTokenBalances: [tb(1, MINT_A, ALICE, 500n, 6)],
      postTokenBalances: [tb(1, MINT_A, BOB, 500n, 6)],
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "mint-change-same-index",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, A_ATA, TOKEN_PROGRAM],
      pre: [SOL, RENT, 1n],
      post: [SOL - 5000n, RENT, 1n],
      instructions: [{ programIdIndex: 2, accounts: [1, 0] }],
      preTokenBalances: [tb(1, MINT_A, ALICE, 900n, 6)],
      postTokenBalances: [tb(1, MINT_B, ALICE, 300n, 2)],
    },
    perspectives: [ALICE],
  },
  {
    id: "missing-pre-snapshot",
    kind: "synthetic",
    input: closeSell,
    mutate: (r) => {
      delete r.meta.preTokenBalances;
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "missing-post-snapshot",
    kind: "synthetic",
    input: closeSell,
    mutate: (r) => {
      delete r.meta.postTokenBalances;
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "missing-both-snapshots",
    kind: "synthetic",
    input: closeSell,
    mutate: (r) => {
      delete r.meta.preTokenBalances;
      delete r.meta.postTokenBalances;
    },
    perspectives: [ALICE],
  },
  {
    id: "raw-ui-sign-disagreement",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, A_ATA, B_ATA, TOKEN_PROGRAM],
      pre: [SOL, RENT, RENT, 1n],
      post: [SOL - 5000n, RENT, RENT, 1n],
      instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
      preTokenBalances: [tb(1, MINT_A, ALICE, 1_000_000n, 6), tb(2, MINT_A, BOB, 0n, 6)],
      postTokenBalances: [tb(1, MINT_A, ALICE, 999_999n, 6), tb(2, MINT_A, BOB, 1n, 6)],
    },
    // UI strings say Alice did not move and Bob got nothing; raw amounts say 1 unit moved.
    mutate: (r) => {
      balances(r, "postTokenBalances")[0]!.uiTokenAmount.uiAmountString = "1";
      balances(r, "postTokenBalances")[1]!.uiTokenAmount.uiAmountString = "0";
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "wsol-closed",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, A_WSOL, TOKEN_PROGRAM],
      pre: [SOL, 3n * SOL, 1n],
      post: [4n * SOL - 5000n, 0n, 1n],
      instructions: [{ programIdIndex: 2, accounts: [1, 0] }],
      preTokenBalances: [tb(1, WSOL_MINT, ALICE, 3n * SOL - RENT, 9)],
      postTokenBalances: [],
    },
    perspectives: [ALICE],
  },
  {
    id: "wsol-created-and-funded",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, A_WSOL, TOKEN_PROGRAM],
      pre: [4n * SOL, 0n, 1n],
      post: [SOL - 5000n, 3n * SOL, 1n],
      instructions: [{ programIdIndex: 2, accounts: [1, 0] }],
      preTokenBalances: [],
      postTokenBalances: [tb(1, WSOL_MINT, ALICE, 3n * SOL - RENT, 9)],
    },
    perspectives: [ALICE],
  },
  {
    id: "dex-tagging-jupiter",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, A_USDC, POOL_USDC, VAULT, JUPITER_V6_PROGRAM_ID],
      pre: [10n * SOL, RENT, RENT, 50n * SOL, 1n],
      post: [11n * SOL - 5000n, RENT, RENT, 49n * SOL, 1n],
      instructions: [{ programIdIndex: 4, accounts: [1, 2, 3, 0] }],
      preTokenBalances: [tb(1, USDC, ALICE, 200_000_000n, 6), tb(2, USDC, POOL_OWNER, 0n, 6)],
      postTokenBalances: [tb(1, USDC, ALICE, 50_000_000n, 6), tb(2, USDC, POOL_OWNER, 150_000_000n, 6)],
    },
    perspectives: [ALICE, POOL_OWNER, null],
  },
  {
    id: "open-to-zero-beside-closed-sibling",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, A_ATA, B_ATA, TOKEN_PROGRAM],
      pre: [SOL, RENT, RENT, 1n],
      post: [SOL - 5000n + RENT, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
      preTokenBalances: [tb(1, MINT_A, ALICE, 1_000n, 6), tb(2, MINT_A, ALICE, 300n, 6)],
      postTokenBalances: [tb(1, MINT_A, ALICE, 0n, 6)],
    },
    perspectives: [ALICE],
  },
  {
    id: "pre-only-keeps-lamports",
    kind: "synthetic",
    input: { ...closeSell, post: [SOL - 5000n, RENT, RENT, 1n] },
    perspectives: [ALICE, BOB],
  },

  // --- review counterexamples: final result must equal 3111fd7 ------------------------
  {
    id: "nft-send-repro",
    kind: "synthetic",
    input: usdcPlusBurnedPosition,
    perspectives: [BOB, ALICE],
  },
  {
    id: "burn-close-zero-decimal-alone",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, A_POS, TOKEN_PROGRAM],
      pre: [SOL, RENT, 1n],
      post: [SOL + RENT - 5000n, 0n, 1n],
      instructions: [{ programIdIndex: 2, accounts: [1, 0] }],
      preTokenBalances: [tb(1, POS, ALICE, 1n, 0)],
      postTokenBalances: [],
    },
    perspectives: [ALICE],
  },
  {
    id: "genuine-nft-send-from-closed-account",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, A_POS, B_POS, TOKEN_PROGRAM],
      pre: [SOL, RENT, 0n, 1n],
      post: [SOL - 5000n, 0n, RENT, 1n],
      instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
      preTokenBalances: [tb(1, POS, ALICE, 1n, 0)],
      postTokenBalances: [tb(2, POS, BOB, 1n, 0)],
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "unrelated-recipient-beside-closed-nft",
    kind: "synthetic",
    input: {
      staticKeys: [DAVE, ALICE, D_USDC, C_USDC, A_POS, TOKEN_PROGRAM],
      pre: [SOL, SOL, RENT, RENT, RENT, 1n],
      post: [SOL - 5000n, SOL + RENT, RENT, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 5, accounts: [2, 3, 0] }],
      preTokenBalances: [tb(2, USDC, DAVE, 9_000_000n, 6), tb(3, USDC, CAROL, 0n, 6), tb(4, POS, ALICE, 1n, 0)],
      postTokenBalances: [tb(2, USDC, DAVE, 4_000_000n, 6), tb(3, USDC, CAROL, 5_000_000n, 6)],
    },
    perspectives: [CAROL, DAVE, ALICE],
  },
  {
    id: "bridge-burn-open-plus-burned-junk",
    kind: "synthetic",
    input: {
      staticKeys: [SPONSOR, ALICE, A_W, A_JUNK, WORMHOLE_TOKEN_BRIDGE_ID],
      pre: [SOL, SOL, RENT, RENT, 1n],
      post: [SOL - 5000n + RENT, SOL, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 4, accounts: [2, 3, 1] }],
      preTokenBalances: [tb(2, W, ALICE, 1_000_000_000n, 8), tb(3, JUNK, ALICE, 2_000_000_000n, 6)],
      postTokenBalances: [tb(2, W, ALICE, 0n, 8)],
    },
    perspectives: [ALICE],
  },
  {
    id: "bridge-in-mint-plus-burned-junk",
    kind: "synthetic",
    input: {
      staticKeys: [SPONSOR, ALICE, A_W, A_JUNK, WORMHOLE_TOKEN_BRIDGE_ID],
      pre: [SOL, SOL, RENT, RENT, 1n],
      post: [SOL - 5000n + RENT, SOL, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 4, accounts: [2, 3, 1] }],
      preTokenBalances: [tb(2, W, ALICE, 0n, 8), tb(3, JUNK, ALICE, 2_000_000_000n, 6)],
      postTokenBalances: [tb(2, W, ALICE, 1_000_000_000n, 8)],
    },
    perspectives: [ALICE],
  },
  {
    id: "bridge-burn-open-plus-burned-sibling-same-mint",
    kind: "synthetic",
    input: wormholeSibling(2_000_000_000n),
    perspectives: [ALICE],
  },
  {
    id: "bridge-burn-open-plus-closed-empty-sibling",
    kind: "synthetic",
    input: wormholeSibling(0n),
    perspectives: [ALICE],
  },
  {
    id: "bridge-burn-open-plus-closed-sibling-5w",
    kind: "synthetic",
    input: wormholeSibling(500_000_000n),
    perspectives: [ALICE],
  },
  {
    id: "marketplace-royalty-before-seller",
    kind: "synthetic",
    input: {
      staticKeys: [BOB, ROYALTY, ALICE, A_POS, B_POS, MAGIC_EDEN_V2_PROGRAM_ID],
      pre: [10n * SOL, SOL, SOL, RENT, 0n, 1n],
      // Bob pays 0.1 SOL royalty and 1.9 SOL to Alice, funds his NFT account and gets the
      // closed seller account's rent back.
      post: [8n * SOL - 5000n, SOL + SOL / 10n, SOL + (19n * SOL) / 10n, 0n, RENT, 1n],
      instructions: [{ programIdIndex: 5, accounts: [3, 4, 0, 1, 2] }],
      preTokenBalances: [tb(3, POS, ALICE, 1n, 0)],
      postTokenBalances: [tb(4, POS, BOB, 1n, 0)],
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "marketplace-escrow-sale-plus-unrelated-burned-nft",
    kind: "synthetic",
    input: {
      staticKeys: [BOB, ALICE, ESCROW_POS, B_POS, A_JNFT, MAGIC_EDEN_V2_PROGRAM_ID],
      pre: [10n * SOL, SOL, RENT, 0n, RENT, 1n],
      post: [8n * SOL - 5000n - RENT, 3n * SOL + RENT, RENT, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 5, accounts: [2, 3, 0, 1, 4] }],
      preTokenBalances: [tb(2, POS, ESCROW, 1n, 0), tb(4, JNFT, ALICE, 1n, 0)],
      postTokenBalances: [tb(2, POS, ESCROW, 0n, 0), tb(3, POS, BOB, 1n, 0)],
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "marketplace-sale-seller-account-closes",
    kind: "synthetic",
    input: {
      staticKeys: [BOB, ALICE, A_POS, B_POS, MAGIC_EDEN_V2_PROGRAM_ID],
      pre: [10n * SOL, SOL, RENT, 0n, 1n],
      post: [8n * SOL - 5000n - RENT, 3n * SOL + RENT, 0n, RENT, 1n],
      instructions: [{ programIdIndex: 4, accounts: [2, 3, 0, 1] }],
      preTokenBalances: [tb(2, POS, ALICE, 1n, 0)],
      postTokenBalances: [tb(3, POS, BOB, 1n, 0)],
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "stake-sponsored-deposit-plus-burned-junk",
    kind: "synthetic",
    input: {
      staticKeys: [BOB, ALICE, A_POOL, RESERVE, A_JUNK, STAKE_POOL_PROGRAM_ID],
      pre: [10n * SOL, SOL, RENT, 100n * SOL, RENT, 1n],
      post: [9n * SOL - 5000n + RENT, SOL, RENT, 101n * SOL, 0n, 1n],
      instructions: [{ programIdIndex: 5, accounts: [0, 2, 3] }],
      preTokenBalances: [tb(2, POOL_MINT, ALICE, 0n, 9), tb(4, JUNK, ALICE, 1_000_000_000n, 6)],
      postTokenBalances: [tb(2, POOL_MINT, ALICE, 900_000_000n, 9)],
    },
    perspectives: [ALICE],
  },
  {
    id: "privacy-deposit-plus-burned-junk",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, PRIVACY_CASH_SPL_POOL, POOL_USDC, A_USDC, A_JUNK, PRIVACY_CASH_PROGRAM_ID],
      pre: [SOL, SOL, RENT, RENT, RENT, 1n],
      post: [SOL + RENT - 5000n, SOL, RENT, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 5, accounts: [3, 2, 0] }],
      preTokenBalances: [tb(2, USDC, PRIVACY_CASH_SPL_POOL, 0n, 6), tb(3, USDC, ALICE, 50_000_000n, 6), tb(4, JUNK, ALICE, 1_000_000_000n, 6)],
      postTokenBalances: [tb(2, USDC, PRIVACY_CASH_SPL_POOL, 10_000_000n, 6), tb(3, USDC, ALICE, 40_000_000n, 6)],
    },
    perspectives: [ALICE],
  },
  {
    id: "airdrop-on-dex-plus-burned-junk",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, VAULT, A_X, A_JUNK, JUPITER_V6_PROGRAM_ID],
      pre: [SOL, RENT, RENT, RENT, 1n],
      post: [SOL + RENT - 5000n, RENT, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 4, accounts: [1, 2, 0] }],
      preTokenBalances: [tb(1, X, POOL_OWNER, 50_000_000n, 6), tb(2, X, ALICE, 0n, 6), tb(3, JUNK, ALICE, 1_000_000_000n, 6)],
      postTokenBalances: [tb(1, X, POOL_OWNER, 45_000_000n, 6), tb(2, X, ALICE, 5_000_000n, 6)],
    },
    perspectives: [ALICE],
  },
  {
    id: "bridge-custody-usdc-plus-burned-junk",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, CUSTODY, "CustUSDC1111111111111111111111111111111111", A_USDC, A_JUNK, WORMHOLE_TOKEN_BRIDGE_ID],
      pre: [SOL, SOL, RENT, RENT, RENT, 1n],
      post: [SOL + RENT - 5000n, SOL, RENT, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 5, accounts: [2, 3, 0] }],
      preTokenBalances: [tb(2, USDC, CUSTODY, 90_000_000n, 6), tb(3, USDC, ALICE, 0n, 6), tb(4, JUNK, ALICE, 1_000_000_000n, 6)],
      postTokenBalances: [tb(2, USDC, CUSTODY, 80_000_000n, 6), tb(3, USDC, ALICE, 10_000_000n, 6)],
    },
    perspectives: [ALICE],
  },

  // --- migrated classifiers (swap, transfer): reported, not required equal -----------
  {
    id: "swap-receive-usdc-plus-burned-junk",
    kind: "synthetic",
    input: {
      staticKeys: [BOB, ALICE, B_USDC, A_USDC, A_JUNK, TOKEN_PROGRAM],
      pre: [SOL, SOL, RENT, RENT, RENT, 1n],
      post: [SOL - 5000n, SOL + RENT, RENT, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 5, accounts: [2, 3, 0] }],
      preTokenBalances: [tb(2, USDC, BOB, 50_000_000n, 6), tb(3, USDC, ALICE, 0n, 6), tb(4, JUNK, ALICE, 1_000_000_000n, 6)],
      postTokenBalances: [tb(2, USDC, BOB, 40_000_000n, 6), tb(3, USDC, ALICE, 10_000_000n, 6)],
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "swap-burn-close-fungible-rent-to-owner",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, A_JUNK, TOKEN_PROGRAM],
      pre: [SOL, RENT, 1n],
      post: [SOL + RENT - 5000n, 0n, 1n],
      instructions: [{ programIdIndex: 2, accounts: [1, 0] }],
      preTokenBalances: [tb(1, JUNK, ALICE, 1_000_000_000n, 6)],
      postTokenBalances: [],
    },
    perspectives: [ALICE],
  },
  {
    id: "swap-sell-and-close-vault-credited",
    kind: "synthetic",
    input: {
      staticKeys: [ALICE, VAULT, A_JUNK, JUPITER_V6_PROGRAM_ID],
      pre: [10n * SOL, 50n * SOL, RENT, 1n],
      post: [11n * SOL + RENT - 5000n, 49n * SOL, 0n, 1n],
      instructions: [{ programIdIndex: 3, accounts: [1, 2, 0] }],
      preTokenBalances: [tb(1, JUNK, POOL_OWNER, 0n, 6), tb(2, JUNK, ALICE, 1_000_000_000n, 6)],
      postTokenBalances: [tb(1, JUNK, POOL_OWNER, 1_000_000_000n, 6)],
    },
    perspectives: [ALICE],
  },
  {
    id: "swap-risk-unrelated-same-mint-credit",
    kind: "synthetic",
    // Bob sends Alice 10 USDC; Alice burns and closes 1,000 JUNK; Carol is minted 5 JUNK.
    input: {
      staticKeys: [BOB, ALICE, B_USDC, A_USDC, A_JUNK, C_JUNK, TOKEN_PROGRAM],
      pre: [SOL, SOL, RENT, RENT, RENT, RENT, 1n],
      post: [SOL - 5000n, SOL + RENT, RENT, RENT, 0n, RENT, 1n],
      instructions: [{ programIdIndex: 6, accounts: [2, 3, 0] }],
      preTokenBalances: [
        tb(2, USDC, BOB, 50_000_000n, 6),
        tb(3, USDC, ALICE, 0n, 6),
        tb(4, JUNK, ALICE, 1_000_000_000n, 6),
        tb(5, JUNK, CAROL, 0n, 6),
      ],
      postTokenBalances: [tb(2, USDC, BOB, 40_000_000n, 6), tb(3, USDC, ALICE, 10_000_000n, 6), tb(5, JUNK, CAROL, 5_000_000n, 6)],
    },
    perspectives: [ALICE, BOB],
  },
  {
    id: "swap-risk-closed-sibling-distorts-amount",
    kind: "synthetic",
    // Alice sells 10 W from open A to the pool vault for 5 USDC and burns and closes sibling B (3 W).
    input: {
      staticKeys: [ALICE, A_W, B_W, VAULT_W, A_USDC, POOL_USDC, JUPITER_V6_PROGRAM_ID],
      pre: [SOL, RENT, RENT, RENT, RENT, RENT, 1n],
      post: [SOL - 5000n + RENT, RENT, 0n, RENT, RENT, RENT, 1n],
      instructions: [{ programIdIndex: 6, accounts: [1, 2, 3, 4, 5, 0] }],
      preTokenBalances: [
        tb(1, W, ALICE, 1_000_000_000n, 8),
        tb(2, W, ALICE, 300_000_000n, 8),
        tb(3, W, POOL_OWNER, 0n, 8),
        tb(4, USDC, ALICE, 0n, 6),
        tb(5, USDC, POOL_OWNER, 50_000_000n, 6),
      ],
      postTokenBalances: [
        tb(1, W, ALICE, 0n, 8),
        tb(3, W, POOL_OWNER, 1_000_000_000n, 8),
        tb(4, USDC, ALICE, 5_000_000n, 6),
        tb(5, USDC, POOL_OWNER, 45_000_000n, 6),
      ],
    },
    perspectives: [ALICE],
  },
  {
    id: "swap-risk-closed-sibling-larger-than-sale",
    kind: "synthetic",
    // Alice sells 10 W from open A to the pool vault for 5 USDC and burns and closes sibling B (30 W).
    input: {
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
      postTokenBalances: [
        tb(1, W, ALICE, 0n, 8),
        tb(3, W, POOL_OWNER, 1_000_000_000n, 8),
        tb(4, USDC, ALICE, 5_000_000n, 6),
        tb(5, USDC, POOL_OWNER, 45_000_000n, 6),
      ],
    },
    perspectives: [ALICE],
  },
  {
    id: "swap-open-sell-vault-unseen-plus-closed-sibling",
    kind: "synthetic",
    input: {
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
    perspectives: [ALICE],
  },
  {
    id: "transfer-other-wallets-token-beside-own-rent",
    kind: "synthetic",
    // Dave sends Carol 5 USDC; Alice only receives rent from a closed account of Dave's.
    input: {
      staticKeys: [DAVE, ALICE, D_USDC, C_USDC, "DaveC1osed111111111111111111111111111111111", TOKEN_PROGRAM],
      pre: [SOL, SOL, RENT, RENT, RENT, 1n],
      post: [SOL - 5000n, SOL + RENT, RENT, RENT, 0n, 1n],
      instructions: [{ programIdIndex: 5, accounts: [2, 3, 0] }],
      preTokenBalances: [tb(2, USDC, DAVE, 9_000_000n, 6), tb(3, USDC, CAROL, 0n, 6)],
      postTokenBalances: [tb(2, USDC, DAVE, 4_000_000n, 6), tb(3, USDC, CAROL, 5_000_000n, 6)],
    },
    perspectives: [ALICE, CAROL, DAVE, null],
  },
];

/** Recorded mainnet fixtures (packages/solana/src/__fixtures__/mainnet). */
export function mainnetFixtureItems(): BodyItem[] {
  const dir = join(REPO, "packages/solana/src/__fixtures__/mainnet");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      const meta = JSON.parse(text)._meta as { signature: string };
      const marker = '"response": ';
      const start = text.indexOf(marker) + marker.length;
      const body = text.slice(start, text.lastIndexOf("}")).trim();
      const parsed = JSON.parse(body) as { result?: { transaction?: { message?: { accountKeys?: string[] } } } };
      const feePayer = parsed.result?.transaction?.message?.accountKeys?.[0] ?? null;
      return {
        id: `fixture:${f}`,
        kind: "body" as const,
        signature: meta.signature,
        body,
        perspectives: feePayer ? [null, feePayer] : [null],
      };
    });
}

/** Every accuracy case, with its labelled perspectives. */
export function accuracyItems(): BodyItem[] {
  const dir = join(REPO, "accuracy/cases");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .map((id) => {
      const kase = JSON.parse(readFileSync(join(dir, id, "case.json"), "utf8")) as {
        signature: string;
        perspectives: Array<{ address: string }>;
      };
      return {
        id: `accuracy:${id}`,
        kind: "body" as const,
        signature: kase.signature,
        body: readFileSync(join(dir, id, "rpc.json"), "utf8"),
        perspectives: kase.perspectives.map((p) => p.address),
      };
    });
}

export function corpus(): CorpusItem[] {
  return [...mainnetFixtureItems(), ...accuracyItems(), ...SYNTHETIC];
}

/** The ten classifiers that read "v1-main" and must equal 3111fd7 one by one. */
export const LEGACY_CLASSIFIERS = [
  ["solana-pay", "solana-pay-classifier", "SolanaPayClassifier"],
  ["privacy-cash", "privacy-cash-classifier", "PrivacyCashClassifier"],
  ["bridge", "bridge-classifier", "BridgeClassifier"],
  ["nft-mint", "nft-mint-classifier", "NftMintClassifier"],
  ["nft-transfer", "nft-transfer-classifier", "NftTransferClassifier"],
  ["stake-deposit", "stake-deposit-classifier", "StakeDepositClassifier"],
  ["stake-withdraw", "stake-withdraw-classifier", "StakeWithdrawClassifier"],
  ["airdrop", "airdrop-classifier", "AirdropClassifier"],
  ["fee-only", "fee-only-classifier", "FeeOnlyClassifier"],
  ["transfer", "transfer-classifier", "TransferClassifier"],
] as const;

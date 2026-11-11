/**
 * The list spam filter reads the "v1-main" legs (its calibrated input), not the returned
 * truthful legs, so its decisions equal 3111fd7's. Repro from review round 6: Dave sends
 * Carol 5 USDC; Alice burns and closes 1,000 JUNK and receives 0.0005 SOL of the rent refund.
 * On 3111fd7 Alice's only leg is a dust SOL credit, so the transaction is filtered for her.
 * In the truthful legs she also has the JUNK debit, which the filter's wallet-involvement
 * rule would read as active participation (not filtered).
 */
import { describe, expect, test } from "bun:test";
import { createIndexer } from "./client";
import { isSpamTransaction } from "@tx-indexer/core/tx/spam-filter";
import { mockRpc, syntheticResponse, SOL, TOKEN_PROGRAM } from "@tx-indexer/solana/__fixtures__/synthetic";

const SIG = "Sweep1111111111111111111111111111111111111111111111111111111111111111111111111111111111";
const ALICE = "A1ice11111111111111111111111111111111111111";
const CAROL = "Caro1111111111111111111111111111111111111111";
const DAVE = "Dave1111111111111111111111111111111111111111";
const D_USDC = "DaveUSDC11111111111111111111111111111111111";
const C_USDC = "CaroUSDC11111111111111111111111111111111111";
const A_JUNK = "A1iceJunk1111111111111111111111111111111111";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUNK = "Junk111111111111111111111111111111111111111";
const RENT = 2_039_280n;
const tb = (accountIndex: number, mint: string, owner: string, amount: bigint, decimals: number) => ({ accountIndex, mint, owner, amount, decimals });

export const DUST_REFUND_BESIDE_OTHER_TRANSFER = {
  staticKeys: [DAVE, ALICE, D_USDC, C_USDC, A_JUNK, TOKEN_PROGRAM],
  pre: [SOL, SOL, RENT, RENT, RENT, 1n],
  post: [SOL - 5000n + RENT - 500_000n, SOL + 500_000n, RENT, RENT, 0n, 1n],
  instructions: [{ programIdIndex: 5, accounts: [2, 3, 0] }],
  preTokenBalances: [tb(2, USDC, DAVE, 9_000_000n, 6), tb(3, USDC, CAROL, 0n, 6), tb(4, JUNK, ALICE, 1_000_000_000n, 6)],
  postTokenBalances: [tb(2, USDC, DAVE, 4_000_000n, 6), tb(3, USDC, CAROL, 5_000_000n, 6)],
};

describe("spam filter input is v1-main", () => {
  const indexer = () =>
    createIndexer({ client: { rpc: mockRpc(() => syntheticResponse(DUST_REFUND_BESIDE_OTHER_TRANSFER)).rpc as never } });
  const opts = { enrichNftMetadata: false, enrichTokenMetadata: false } as const;

  test("Alice: filtered from lists, as on 3111fd7; the returned legs still show her JUNK debit", async () => {
    const listed = await indexer().getTransactionsBySignatures([SIG], ALICE, { ...opts, filterSpam: true });
    expect(listed).toHaveLength(0);
    const all = await indexer().getTransactionsBySignatures([SIG], ALICE, { ...opts, filterSpam: false });
    expect(all).toHaveLength(1);
    const t = all[0]!;
    expect(t.legs.some((l) => l.closedTokenAccount === A_JUNK && l.accountId === `external:${ALICE}`)).toBe(true);
    // the filter fed the returned (truthful) legs would keep it: this is what the v1 input prevents
    expect(isSpamTransaction(t.tx, t.classification, {}, t.legs, ALICE)).toBe(false);
  });

  test("Carol (the real recipient) still sees it", async () => {
    expect(await indexer().getTransactionsBySignatures([SIG], CAROL, { ...opts, filterSpam: true })).toHaveLength(1);
  });
});

import type { TxLeg, RawTransaction, TxLegRole } from "@tx-indexer/core/tx/tx.types";
import type { MoneyAmount } from "@tx-indexer/core/money/money.types";
import type { Signature } from "@solana/kit";

export function createMockMoneyAmount(options: {
  symbol: string;
  decimals: number;
  amountUi: number;
  mint?: string;
  name?: string;
}): MoneyAmount {
  const { symbol, decimals, amountUi, mint, name } = options;
  const amountRaw = Math.floor(amountUi * Math.pow(10, decimals)).toString();

  return {
    token: {
      mint: mint ?? `${symbol}_MINT_ADDRESS`,
      symbol,
      name: name ?? symbol,
      decimals,
    },
    amountRaw,
    amountUi,
  };
}

export function createMockLeg(options: {
  accountId: string;
  side: "debit" | "credit";
  role: TxLegRole;
  amount: MoneyAmount;
}): TxLeg {
  return {
    accountId: options.accountId,
    side: options.side,
    role: options.role,
    amount: options.amount,
  };
}

export function createMockTransaction(
  overrides?: Partial<RawTransaction>
): RawTransaction {
  return {
    signature: "test-signature-123" as Signature,
    slot: 123456789n,
    blockTime: 1700000000n,
    err: null,
    programIds: [],
    protocol: null,
    preTokenBalances: [],
    postTokenBalances: [],
    preBalances: [],
    postBalances: [],
    accountKeys: [],
    memo: null,
    ...overrides,
  };
}

export function createSolAmount(amountUi: number): MoneyAmount {
  return createMockMoneyAmount({
    symbol: "SOL",
    decimals: 9,
    amountUi,
    mint: "So11111111111111111111111111111111111111112",
    name: "Solana",
  });
}

export function createNftAmount(name: string, mint?: string): MoneyAmount {
  return createMockMoneyAmount({
    symbol: "NFT",
    decimals: 0,
    amountUi: 1,
    mint: mint ?? `NFT_${name.replace(/\s+/g, "_").toUpperCase()}_MINT`,
    name,
  });
}

export function createTokenAmount(
  symbol: string,
  decimals: number,
  amountUi: number,
  mint?: string
): MoneyAmount {
  return createMockMoneyAmount({
    symbol,
    decimals,
    amountUi,
    mint,
  });
}

export function createUsdcAmount(amountUi: number): MoneyAmount {
  return createMockMoneyAmount({
    symbol: "USDC",
    decimals: 6,
    amountUi,
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "USD Coin",
  });
}

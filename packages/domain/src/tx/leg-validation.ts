import type { TxLeg } from "./tx.types";

export interface LegTokenBalance {
  debits: number;
  credits: number;
  diff: number;
}

export interface LegBalanceResult {
  isBalanced: boolean;
  byToken: Record<string, LegTokenBalance>;
}

export function validateLegsBalance(legs: TxLeg[]): LegBalanceResult {
  const byToken: Record<string, { debits: number; credits: number }> = {};

  for (const leg of legs) {
    const token = leg.amount.token.symbol;
    if (!byToken[token]) {
      byToken[token] = { debits: 0, credits: 0 };
    }

    if (leg.side === "debit") {
      byToken[token].debits += leg.amount.amountUi;
    } else {
      byToken[token].credits += leg.amount.amountUi;
    }
  }

  const result: Record<string, LegTokenBalance> = {};
  let isBalanced = true;

  for (const [token, amounts] of Object.entries(byToken)) {
    const diff = Math.abs(amounts.debits - amounts.credits);
    result[token] = { ...amounts, diff };

    if (diff > 0.000001) {
      isBalanced = false;
    }
  }

  return { isBalanced, byToken: result };
}

export function groupLegsByAccount(legs: TxLeg[]): Record<string, TxLeg[]> {
  const grouped: Record<string, TxLeg[]> = {};

  for (const leg of legs) {
    if (!grouped[leg.accountId]) {
      grouped[leg.accountId] = [];
    }
    grouped[leg.accountId]!.push(leg);
  }

  return grouped;
}

export function groupLegsByToken(legs: TxLeg[]): Record<string, TxLeg[]> {
  const grouped: Record<string, TxLeg[]> = {};

  for (const leg of legs) {
    const token = leg.amount.token.symbol;
    if (!grouped[token]) {
      grouped[token] = [];
    }
    grouped[token]!.push(leg);
  }

  return grouped;
}


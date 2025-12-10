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

/**
 * Validates that transaction legs balance according to double-entry accounting.
 * 
 * For each token, verifies that total debits equal total credits (within a small tolerance
 * for floating-point precision). This ensures the transaction legs accurately represent
 * all balance movements.
 * 
 * @param legs - Array of transaction legs to validate
 * @returns Validation result with per-token balance information
 */
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

/**
 * Groups transaction legs by account ID.
 * 
 * Useful for analyzing all balance movements for a specific account or
 * understanding counterparty interactions in a transaction.
 * 
 * @param legs - Array of transaction legs to group
 * @returns Map of account IDs to their associated legs
 */
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

/**
 * Groups transaction legs by token symbol.
 * 
 * Useful for analyzing all movements of a specific token or calculating
 * total amounts exchanged for each asset in the transaction.
 * 
 * @param legs - Array of transaction legs to group
 * @returns Map of token symbols to their associated legs
 */
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


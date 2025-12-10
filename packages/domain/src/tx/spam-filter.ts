import type { TransactionClassification } from "./classification.types";
import type { RawTransaction } from "./tx.types";

export interface SpamFilterConfig {
  minSolAmount?: number;
  minTokenAmountUsd?: number;
  minConfidence?: number;
  allowFailed?: boolean;
}

const DEFAULT_CONFIG: Required<SpamFilterConfig> = {
  minSolAmount: 0.001,
  minTokenAmountUsd: 0.01,
  minConfidence: 0.5,
  allowFailed: false,
};

/**
 * Determines if a transaction should be filtered as spam or dust.
 * 
 * A transaction is considered spam if it:
 * - Failed (and allowFailed is false)
 * - Has low classification confidence
 * - Is not relevant to the wallet
 * - Involves dust amounts below configured thresholds
 * 
 * @param tx - Raw transaction data
 * @param classification - Transaction classification result
 * @param config - Optional spam filter configuration (uses defaults if omitted)
 * @returns True if the transaction should be filtered as spam
 */
export function isSpamTransaction(
  tx: RawTransaction,
  classification: TransactionClassification,
  config: SpamFilterConfig = {}
): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!cfg.allowFailed && tx.err) {
    return true;
  }

  if (classification.confidence < cfg.minConfidence) {
    return true;
  }

  if (!classification.isRelevant) {
    return true;
  }

  if (isDustTransaction(classification, cfg)) {
    return true;
  }

  return false;
}

function isDustTransaction(
  classification: TransactionClassification,
  config: Required<SpamFilterConfig>
): boolean {
  const { primaryAmount } = classification;
  
  if (!primaryAmount) {
    return false;
  }

  const { token, amountUi } = primaryAmount;

  if (token.symbol === "SOL") {
    return Math.abs(amountUi) < config.minSolAmount;
  }

  if (token.symbol === "USDC") {
    return Math.abs(amountUi) < config.minTokenAmountUsd;
  }

  return Math.abs(amountUi) < config.minTokenAmountUsd;
}

/**
 * Filters an array of transactions to remove spam and dust transactions.
 * 
 * Applies spam detection criteria to each transaction while preserving
 * additional properties in the returned array items.
 * 
 * @param transactions - Array of transaction objects with tx and classification
 * @param config - Optional spam filter configuration
 * @returns Filtered array with spam transactions removed
 */
export function filterSpamTransactions<T extends {
  tx: RawTransaction;
  classification: TransactionClassification;
}>(
  transactions: T[],
  config?: SpamFilterConfig
): T[] {
  return transactions.filter(
    ({ tx, classification }) => !isSpamTransaction(tx, classification, config)
  );
}


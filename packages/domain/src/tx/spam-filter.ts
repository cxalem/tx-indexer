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

export function filterSpamTransactions(
  transactions: Array<{
    tx: RawTransaction;
    classification: TransactionClassification;
  }>,
  config?: SpamFilterConfig
): Array<{
  tx: RawTransaction;
  classification: TransactionClassification;
}> {
  return transactions.filter(
    ({ tx, classification }) => !isSpamTransaction(tx, classification, config)
  );
}


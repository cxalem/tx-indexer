import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";

/**
 * Classifies pure memo / data storage transactions.
 *
 * Priority 62 — just above fee-only (60).
 *
 * Detects transactions that are purely memo-based: they have a memo field,
 * no meaningful token movements beyond fees.
 * These are on-chain data anchoring or message-logging transactions.
 */
export class MemoClassifier implements Classifier {
  name = "memo";
  priority = 62;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    // Must have a memo
    if (!tx.memo) {
      return null;
    }

    // Check that there are no meaningful (non-fee) token movements
    const nonFeeLegs = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.role !== "fee",
    );

    if (nonFeeLegs.length > 0) {
      return null;
    }

    const initiator = tx.accountKeys?.[0] ?? null;

    return {
      primaryType: "memo",
      primaryAmount: null,
      secondaryAmount: null,
      sender: initiator,
      receiver: null,
      counterparty: null,
      confidence: 0.9,
      isRelevant: true,
      metadata: {
        memo: tx.memo,
      },
    };
  }
}

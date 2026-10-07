import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isTipProtocolById } from "../protocols/detector";

/**
 * Classifies Jito tip transactions.
 *
 * Priority 73 — above reward (71) but below swaps (80).
 *
 * Detects SOL tips sent to Jito block engine for priority transaction inclusion.
 * These are pure SOL debits to tip accounts — the user gets nothing back except priority.
 */
export class TipClassifier implements Classifier {
  name = "tip";
  priority = 73;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    if (!isTipProtocolById(tx.protocol?.id)) {
      return null;
    }

    const initiator = tx.accountKeys?.[0] ?? null;
    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    // Look for SOL debits from initiator (the tip amount)
    const tipLegs = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "debit" &&
        leg.role !== "fee" &&
        leg.amount.token.symbol === "SOL",
    );

    if (tipLegs.length === 0) {
      return null;
    }

    // Sum all tip amounts
    const totalTip = tipLegs.reduce((sum, l) => sum + l.amount.amountUi, 0);
    const primaryLeg = tipLegs[0]!;

    return {
      primaryType: "tip",
      primaryAmount: {
        ...primaryLeg.amount,
        amountUi: totalTip,
        amountRaw: tipLegs.reduce(
          (sum, l) => (BigInt(sum) + BigInt(l.amount.amountRaw)).toString(),
          "0",
        ),
      },
      secondaryAmount: null,
      sender: initiator,
      receiver: null,
      counterparty: null,
      confidence: 0.9,
      isRelevant: true,
      metadata: {
        protocol: tx.protocol?.id,
        tip_amount_sol: totalTip,
      },
    };
  }
}

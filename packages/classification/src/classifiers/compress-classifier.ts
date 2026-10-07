import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isCompressionProtocolById } from "../protocols/detector";

/**
 * Classifies ZK compression / decompression transactions.
 *
 * Priority 86 — above NFT mints (85) since compression wraps lower-level ops.
 *
 * Detects compress (user sends tokens to compression program)
 * and decompress (user receives tokens from compression program).
 */
export class CompressClassifier implements Classifier {
  name = "compress";
  priority = 86;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    if (!isCompressionProtocolById(tx.protocol?.id)) {
      return null;
    }

    const initiator = tx.accountKeys?.[0] ?? null;
    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    const debits = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "debit" &&
        leg.role !== "fee",
    );

    const credits = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "credit",
    );

    if (debits.length === 0 && credits.length === 0) {
      return null;
    }

    const totalDebitValue = debits.reduce((sum, l) => sum + l.amount.amountUi, 0);
    const totalCreditValue = credits.reduce((sum, l) => sum + l.amount.amountUi, 0);

    const isCompress = totalDebitValue >= totalCreditValue;
    const primaryType = isCompress ? "compress" : "decompress";

    const primaryLegs = isCompress ? debits : credits;
    const primaryLeg = primaryLegs[0];

    if (!primaryLeg) {
      return null;
    }

    return {
      primaryType,
      primaryAmount: primaryLeg.amount,
      secondaryAmount: null,
      sender: isCompress ? initiator : null,
      receiver: isCompress ? null : initiator,
      counterparty: null,
      confidence: 0.85,
      isRelevant: true,
      metadata: {
        protocol: tx.protocol?.id,
        token: primaryLeg.amount.token.symbol,
      },
    };
  }
}

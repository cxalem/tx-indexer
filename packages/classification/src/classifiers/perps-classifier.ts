import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isPerpsProtocolById } from "../protocols/detector";

/**
 * Classifies perpetual / derivatives transactions (open/close positions).
 *
 * Priority 84 — above lending (83) but below NFT mints (85).
 *
 * Detects opening positions (user deposits margin collateral)
 * and closing positions (user receives PnL / collateral back).
 */
export class PerpsClassifier implements Classifier {
  name = "perps";
  priority = 84;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    if (!isPerpsProtocolById(tx.protocol?.id)) {
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

    // Open: user deposits margin (debits > credits)
    // Close: user receives PnL back (credits > debits)
    const isOpen = totalDebitValue > totalCreditValue;
    const primaryType = isOpen ? "perp_open" : "perp_close";

    const primaryLegs = isOpen ? debits : credits;
    const primaryLeg =
      primaryLegs.find(
        (l) => l.amount.token.symbol !== "SOL" && l.amount.token.symbol !== "WSOL",
      ) ?? primaryLegs[0];

    if (!primaryLeg) {
      return null;
    }

    return {
      primaryType,
      primaryAmount: primaryLeg.amount,
      secondaryAmount: null,
      sender: isOpen ? initiator : null,
      receiver: isOpen ? null : initiator,
      counterparty: null,
      confidence: 0.85,
      isRelevant: true,
      metadata: {
        protocol: tx.protocol?.id,
        protocol_name: tx.protocol?.name,
        collateral_token: primaryLeg.amount.token.symbol,
      },
    };
  }
}

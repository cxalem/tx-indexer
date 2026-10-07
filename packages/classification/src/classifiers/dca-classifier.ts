import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isDcaProtocolById } from "../protocols/detector";

/**
 * Classifies DCA (Dollar Cost Averaging) transactions.
 *
 * Priority 83 — same level as lending, above swaps (80).
 *
 * Detects DCA deposits (user funds a DCA vault) and
 * DCA withdrawals (user reclaims unspent funds or receives output tokens).
 */
export class DcaClassifier implements Classifier {
  name = "dca";
  priority = 83;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    if (!isDcaProtocolById(tx.protocol?.id)) {
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

    const isDeposit = totalDebitValue >= totalCreditValue;
    const primaryType = isDeposit ? "dca_deposit" : "dca_withdraw";

    const primaryLegs = isDeposit ? debits : credits;
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
      sender: isDeposit ? initiator : null,
      receiver: isDeposit ? null : initiator,
      counterparty: null,
      confidence: 0.85,
      isRelevant: true,
      metadata: {
        protocol: tx.protocol?.id,
        dca_token: primaryLeg.amount.token.symbol,
      },
    };
  }
}

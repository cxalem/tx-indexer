import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";

/**
 * Classifies account close transactions (reclaiming rent SOL).
 *
 * Priority 61 — just above fee-only (60).
 *
 * Detects when a user closes token accounts to reclaim rent-exempt SOL.
 * Pattern: user receives small SOL credits (rent refund) with no non-fee,
 * non-SOL token movements. The SOL credits come back as "received" role.
 */
export class AccountCloseClassifier implements Classifier {
  name = "account-close";
  priority = 61;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const initiator = tx.accountKeys?.[0] ?? null;
    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    // Look for SOL credits (rent refunds) to the initiator
    const solCredits = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "credit" &&
        leg.amount.token.symbol === "SOL" &&
        (leg.role === "received" || leg.role === "protocol_withdraw"),
    );

    if (solCredits.length === 0) {
      return null;
    }

    // Must have NO non-fee, non-SOL token movements (pure account close)
    const nonSolNonFeeLegs = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.role !== "fee" &&
        leg.amount.token.symbol !== "SOL" &&
        leg.amount.token.symbol !== "WSOL",
    );

    if (nonSolNonFeeLegs.length > 0) {
      return null;
    }

    // Must have NO non-fee SOL debits from initiator (otherwise it's a transfer out)
    const solDebits = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "debit" &&
        leg.role !== "fee" &&
        leg.amount.token.symbol === "SOL",
    );

    if (solDebits.length > 0) {
      return null;
    }

    // Sum the rent refund
    const totalRefund = solCredits.reduce((sum, l) => sum + l.amount.amountUi, 0);
    const primaryLeg = solCredits[0]!;

    return {
      primaryType: "account_close",
      primaryAmount: {
        ...primaryLeg.amount,
        amountUi: totalRefund,
        amountRaw: solCredits.reduce(
          (sum, l) => (BigInt(sum) + BigInt(l.amount.amountRaw)).toString(),
          "0",
        ),
      },
      secondaryAmount: null,
      sender: null,
      receiver: initiator,
      counterparty: null,
      confidence: 0.9,
      isRelevant: true,
      metadata: {
        accounts_closed: solCredits.length,
        rent_reclaimed_sol: totalRefund,
      },
    };
  }
}

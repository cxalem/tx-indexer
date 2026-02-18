import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isGovernanceProtocolById } from "../protocols/detector";

/**
 * Classifies governance transactions (voting, proposals).
 *
 * Priority 84 — same as perps, above lending (83).
 *
 * Detects governance votes (user deposits governance tokens to vote)
 * and proposal creation (user creates a proposal — no token movement needed).
 *
 * Heuristic: if the user sends tokens, it's a vote (depositing governance tokens).
 * If no tokens move (or only fees), it's likely a proposal creation or vote without token lock.
 */
export class GovernanceClassifier implements Classifier {
  name = "governance";
  priority = 84;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    if (!isGovernanceProtocolById(tx.protocol?.id)) {
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

    // Vote: user deposits governance tokens (has non-fee debits)
    if (debits.length > 0) {
      const primaryLeg = debits[0]!;
      return {
        primaryType: "governance_vote",
        primaryAmount: primaryLeg.amount,
        secondaryAmount: null,
        sender: initiator,
        receiver: null,
        counterparty: null,
        confidence: 0.8,
        isRelevant: true,
        metadata: {
          protocol: tx.protocol?.id,
          governance_token: primaryLeg.amount.token.symbol,
        },
      };
    }

    // Proposal creation: no token movement (only fees) or receiving tokens back
    if (credits.length > 0 || legs.some((l) => l.role === "fee")) {
      return {
        primaryType: "governance_proposal",
        primaryAmount: credits[0]?.amount ?? null,
        secondaryAmount: null,
        sender: initiator,
        receiver: null,
        counterparty: null,
        confidence: 0.75,
        isRelevant: true,
        metadata: {
          protocol: tx.protocol?.id,
        },
      };
    }

    return null;
  }
}

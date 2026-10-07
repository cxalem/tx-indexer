import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";

/**
 * Classifies escrow transactions (create/release).
 *
 * Priority 83 — same level as lending/DCA.
 *
 * Detects escrow creation (user sends tokens to a protocol-managed account)
 * and escrow release (tokens come back from protocol to user).
 *
 * Heuristic: protocol legs exist, user debits go to protocol (create)
 * or protocol credits come to user (release). Distinguished from swaps
 * by having only ONE token type involved (not two-sided exchange).
 */
export class EscrowClassifier implements Classifier {
  name = "escrow";
  priority = 83;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    // Escrow needs protocol legs
    const protocolLegs = legs.filter((leg) =>
      leg.accountId.startsWith("protocol:"),
    );

    if (protocolLegs.length === 0) {
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

    // Only one token type should be involved (not a swap)
    const allTokenMints = new Set([
      ...debits.map((l) => l.amount.token.mint),
      ...credits.map((l) => l.amount.token.mint),
    ]);

    if (allTokenMints.size > 1) {
      return null;
    }

    // Must not have known protocol that overrides (we're a fallback pattern)
    if (tx.protocol?.id) {
      return null;
    }

    // Escrow create: user debits, protocol receives
    if (debits.length > 0 && credits.length === 0) {
      const primaryLeg = debits[0]!;
      return {
        primaryType: "escrow_create",
        primaryAmount: primaryLeg.amount,
        secondaryAmount: null,
        sender: initiator,
        receiver: null,
        counterparty: null,
        confidence: 0.7,
        isRelevant: true,
        metadata: {
          escrowed_token: primaryLeg.amount.token.symbol,
          escrowed_amount: primaryLeg.amount.amountUi,
        },
      };
    }

    // Escrow release: user receives from protocol
    if (credits.length > 0 && debits.length === 0) {
      const primaryLeg = credits[0]!;
      return {
        primaryType: "escrow_release",
        primaryAmount: primaryLeg.amount,
        secondaryAmount: null,
        sender: null,
        receiver: initiator,
        counterparty: null,
        confidence: 0.7,
        isRelevant: true,
        metadata: {
          released_token: primaryLeg.amount.token.symbol,
          released_amount: primaryLeg.amount.amountUi,
        },
      };
    }

    return null;
  }
}

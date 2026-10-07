import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isDomainProtocolById } from "../protocols/detector";

/**
 * Classifies domain / naming service transactions.
 *
 * Priority 84 — above lending (83).
 *
 * Detects domain registrations (user pays SOL/token to register a .sol name)
 * and domain transfers (NFT-like domain token moves between wallets).
 */
export class DomainClassifier implements Classifier {
  name = "domain";
  priority = 84;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    if (!isDomainProtocolById(tx.protocol?.id)) {
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

    // Check for domain token transfer: decimals=0 NFT-like token moving
    const domainTokenDebits = debits.filter((l) => l.amount.token.decimals === 0);
    const domainTokenCredits = credits.filter((l) => l.amount.token.decimals === 0);

    // Domain transfer: user sends or receives a domain NFT
    if (domainTokenDebits.length > 0 || domainTokenCredits.length > 0) {
      const primaryLeg = domainTokenDebits[0] ?? domainTokenCredits[0]!;
      return {
        primaryType: "domain_transfer",
        primaryAmount: primaryLeg.amount,
        secondaryAmount: null,
        sender: domainTokenDebits.length > 0 ? initiator : null,
        receiver: domainTokenCredits.length > 0 ? initiator : null,
        counterparty: null,
        confidence: 0.8,
        isRelevant: true,
        metadata: {
          protocol: tx.protocol?.id,
          domain_token: primaryLeg.amount.token.symbol,
        },
      };
    }

    // Domain registration: user pays SOL/token (no domain token moves)
    if (debits.length > 0) {
      const paymentLeg = debits[0]!;
      return {
        primaryType: "domain_register",
        primaryAmount: paymentLeg.amount,
        secondaryAmount: null,
        sender: initiator,
        receiver: null,
        counterparty: null,
        confidence: 0.8,
        isRelevant: true,
        metadata: {
          protocol: tx.protocol?.id,
          registration_cost: paymentLeg.amount.amountUi,
          payment_token: paymentLeg.amount.token.symbol,
        },
      };
    }

    return null;
  }
}

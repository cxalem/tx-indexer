import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isMultisigProtocolById } from "../protocols/detector";

/**
 * Classifies multisig transactions (approve/execute).
 *
 * Priority 89 — highest among classifiers since multisig wraps other operations.
 *
 * Detects multisig approvals (signer approves — typically no token movement)
 * and executions (final signer triggers the wrapped transaction — tokens move).
 */
export class MultisigClassifier implements Classifier {
  name = "multisig";
  priority = 89;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    if (!isMultisigProtocolById(tx.protocol?.id)) {
      return null;
    }

    const initiator = tx.accountKeys?.[0] ?? null;
    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    const nonFeeLegs = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.role !== "fee",
    );

    // Execution: actual token movement happens
    if (nonFeeLegs.length > 0) {
      const primaryLeg = nonFeeLegs.find(
        (l) => l.side === "debit" && l.accountId === initiatorAccountId,
      ) ?? nonFeeLegs[0]!;

      return {
        primaryType: "multisig_execute",
        primaryAmount: primaryLeg.amount,
        secondaryAmount: null,
        sender: initiator,
        receiver: null,
        counterparty: null,
        confidence: 0.85,
        isRelevant: true,
        metadata: {
          protocol: tx.protocol?.id,
          protocol_name: tx.protocol?.name,
        },
      };
    }

    // Approval: no token movement beyond fees
    return {
      primaryType: "multisig_approve",
      primaryAmount: null,
      secondaryAmount: null,
      sender: initiator,
      receiver: null,
      counterparty: null,
      confidence: 0.8,
      isRelevant: true,
      metadata: {
        protocol: tx.protocol?.id,
        protocol_name: tx.protocol?.name,
        signer: initiator,
      },
    };
  }
}

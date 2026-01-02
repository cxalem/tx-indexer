import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { detectFacilitator } from "@tx-indexer/solana/constants/program-ids";

/**
 * Finds the best transfer pair (sender -> receiver) from the legs.
 * Returns the pair with the largest transfer amount to avoid picking up
 * tiny SOL amounts used for fees.
 */
function findBestTransferPair(
  legs: TxLeg[],
): { senderLeg: TxLeg; receiverLeg: TxLeg } | null {
  // Get all potential sender legs (external debits with "sent" role)
  const senderLegs = legs.filter(
    (l) =>
      l.accountId.startsWith("external:") &&
      l.side === "debit" &&
      l.role === "sent",
  );

  if (senderLegs.length === 0) return null;

  let bestPair: { senderLeg: TxLeg; receiverLeg: TxLeg } | null = null;
  let bestAmount = 0;

  for (const senderLeg of senderLegs) {
    // Find matching receiver for the same token
    const receiverLeg = legs.find(
      (l) =>
        l.accountId.startsWith("external:") &&
        l.side === "credit" &&
        l.role === "received" &&
        l.amount.token.mint === senderLeg.amount.token.mint &&
        l.accountId !== senderLeg.accountId, // Must be different account
    );

    if (receiverLeg) {
      // Use the UI amount to determine the "largest" transfer
      const amount = senderLeg.amount.amountUi;
      if (amount > bestAmount) {
        bestAmount = amount;
        bestPair = { senderLeg, receiverLeg };
      }
    }
  }

  return bestPair;
}

export class TransferClassifier implements Classifier {
  name = "transfer";
  priority = 20;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const facilitator = tx.accountKeys
      ? detectFacilitator(tx.accountKeys)
      : null;

    const pair = findBestTransferPair(legs);
    if (!pair) return null;

    const { senderLeg, receiverLeg } = pair;
    const sender = senderLeg.accountId.replace("external:", "");
    const receiver = receiverLeg.accountId.replace("external:", "");

    return {
      primaryType: "transfer",
      primaryAmount: senderLeg.amount,
      secondaryAmount: null,
      sender,
      receiver,
      counterparty: {
        type: "unknown",
        address: receiver,
        name: `${receiver.slice(0, 8)}...`,
      },
      confidence: 0.95,
      isRelevant: true,
      metadata: {
        ...(facilitator && { facilitator, payment_type: "facilitated" }),
      },
    };
  }
}

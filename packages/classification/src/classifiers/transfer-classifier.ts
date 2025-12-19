import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { detectFacilitator } from "@tx-indexer/solana/constants/program-ids";

export class TransferClassifier implements Classifier {
  name = "transfer";
  priority = 20;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const facilitator = tx.accountKeys
      ? detectFacilitator(tx.accountKeys)
      : null;

    const senderLeg = legs.find(
      (l) =>
        l.accountId.startsWith("external:") &&
        l.side === "debit" &&
        l.role === "sent"
    );

    if (!senderLeg) return null;

    const sender = senderLeg.accountId.replace("external:", "");

    const receiverLeg = legs.find(
      (l) =>
        l.accountId.startsWith("external:") &&
        l.side === "credit" &&
        l.role === "received" &&
        l.amount.token.mint === senderLeg.amount.token.mint
    );

    if (!receiverLeg) return null;

    const receiver = receiverLeg.accountId.replace("external:", "");

    return {
      primaryType: "transfer",
      primaryAmount: senderLeg.amount,
      secondaryAmount: null,
      sender,
      receiver,
      counterparty: {
        type: "wallet",
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

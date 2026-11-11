import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { detectFacilitator } from "@tx-indexer/solana/constants/program-ids";
import { findBestExternalTransferPair } from "../engine/transfer-pairing";

export class TransferClassifier implements Classifier {
  name = "transfer";
  priority = 20;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const facilitator = tx.accountKeys
      ? detectFacilitator(tx.accountKeys)
      : null;

    const pair = findBestExternalTransferPair(legs);
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

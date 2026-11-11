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
  // Migrated: reads the truthful legs (token accounts closed in the transaction included).
  inputVersion = "v2-closed-token-accounts" as const;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx, walletAddress } = context;

    const facilitator = tx.accountKeys
      ? detectFacilitator(tx.accountKeys)
      : null;

    // With a wallet, only transfers the wallet takes part in (as sender or receiver) are
    // eligible: another wallet's transfer in the same transaction is not this wallet's
    // action. Without a wallet, the whole transaction is considered, as before.
    const pair = findBestExternalTransferPair(
      legs,
      undefined,
      undefined,
      walletAddress ? { participant: walletAddress } : undefined,
    );
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

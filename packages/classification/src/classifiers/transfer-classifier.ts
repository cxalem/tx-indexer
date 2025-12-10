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
    const { legs, walletAddress, tx } = context;
    
    const facilitator = tx.accountKeys 
      ? detectFacilitator(tx.accountKeys) 
      : null;

    const walletPrefix = `wallet:${walletAddress.toLowerCase()}`;

    const userSent = legs.filter(
      (l) =>
        l.accountId.toLowerCase().startsWith(walletPrefix) &&
        l.side === "debit" &&
        l.role === "sent"
    );

    const externalReceived = legs.filter(
      (l) =>
        l.accountId.startsWith("external:") &&
        l.side === "credit" &&
        l.role === "received"
    );

    const userReceived = legs.filter(
      (l) =>
        l.accountId.toLowerCase().startsWith(walletPrefix) &&
        l.side === "credit" &&
        l.role === "received"
    );

    const externalSent = legs.filter(
      (l) =>
        l.accountId.startsWith("external:") &&
        l.side === "debit" &&
        l.role === "sent"
    );

    if (userSent.length === 1 && externalReceived.length === 1) {
      const sent = userSent[0]!;
      const received = externalReceived[0]!;

      if (sent.amount.token.mint === received.amount.token.mint) {
        return {
          primaryType: "transfer",
          direction: "outgoing",
          primaryAmount: sent.amount,
          secondaryAmount: null,
          counterparty: {
            type: "unknown",
            address: received.accountId.replace("external:", ""),
            name: `${received.accountId.replace("external:", "").slice(0, 8)}...`,
          },
          confidence: 0.95,
          isRelevant: true,
          metadata: facilitator
            ? {
                facilitator,
                payment_type: "facilitated",
              }
            : undefined,
        };
      }
    }

    if (userReceived.length === 1 && externalSent.length === 1) {
      const received = userReceived[0]!;
      const sent = externalSent[0]!;

      if (sent.amount.token.mint === received.amount.token.mint) {
        return {
          primaryType: "transfer",
          direction: "incoming",
          primaryAmount: received.amount,
          secondaryAmount: null,
          counterparty: {
            type: "unknown",
            address: sent.accountId.replace("external:", ""),
            name: `${sent.accountId.replace("external:", "").slice(0, 8)}...`,
          },
          confidence: 0.95,
          isRelevant: true,
          metadata: facilitator
            ? {
                facilitator,
                payment_type: "facilitated",
              }
            : undefined,
        };
      }
    }

    return null;
  }
}


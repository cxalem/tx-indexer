import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import {
  isSolanaPayTransaction,
  parseSolanaPayMemo,
} from "@tx-indexer/solana/mappers/memo-parser";

export class SolanaPayClassifier implements Classifier {
  name = "solana-pay";
  priority = 95;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { tx, legs } = context;

    if (!isSolanaPayTransaction(tx.programIds, tx.memo)) {
      return null;
    }

    const memo = parseSolanaPayMemo(tx.memo!);

    const senderLeg = legs.find(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "debit" &&
        leg.role === "sent"
    );

    const receiverLeg = legs.find(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "credit" &&
        leg.role === "received"
    );

    const sender = senderLeg?.accountId.replace("external:", "") ?? null;
    const receiver = receiverLeg?.accountId.replace("external:", "") ?? null;
    const primaryAmount = senderLeg?.amount ?? receiverLeg?.amount ?? null;

    return {
      primaryType: "transfer",
      primaryAmount,
      secondaryAmount: null,
      sender,
      receiver,
      counterparty: receiver
        ? {
            address: receiver,
            name: memo.merchant ?? undefined,
            type: memo.merchant ? "merchant" : "unknown",
          }
        : null,
      confidence: 0.98,
      isRelevant: true,
      metadata: {
        payment_type: "solana_pay",
        memo: memo.raw,
        merchant: memo.merchant,
        item: memo.item,
        reference: memo.reference,
        label: memo.label,
        message: memo.message,
      },
    };
  }
}

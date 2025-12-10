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
    const { tx, walletAddress, legs } = context;

    if (!isSolanaPayTransaction(tx.programIds, tx.memo)) {
      return null;
    }

    const walletPrefix = `wallet:${walletAddress}`;

    const userSent = legs.find(
      (leg) =>
        leg.accountId.includes(walletPrefix) &&
        leg.side === "debit" &&
        leg.role === "sent"
    );

    const userReceived = legs.find(
      (leg) =>
        leg.accountId.includes(walletPrefix) &&
        leg.side === "credit" &&
        leg.role === "received"
    );

    const memo = parseSolanaPayMemo(tx.memo!);

    const direction = userSent ? "outgoing" : "incoming";
    const primaryAmount = userSent?.amount ?? userReceived?.amount ?? null;

    return {
      primaryType: "transfer",
      direction,
      primaryAmount,
      secondaryAmount: null,
      counterparty: memo.merchant
        ? {
            address: "",
            name: memo.merchant,
            type: "merchant",
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


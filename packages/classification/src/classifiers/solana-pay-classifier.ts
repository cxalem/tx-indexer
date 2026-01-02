import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import {
  isSolanaPayTransaction,
  parseSolanaPayMemo,
} from "@tx-indexer/solana/mappers/memo-parser";

/**
 * Finds the best transfer pair (sender -> receiver) from the legs.
 * Returns the pair with the largest transfer amount to avoid picking up
 * tiny SOL amounts used for fees.
 */
function findBestTransferPair(
  legs: TxLeg[],
): { senderLeg: TxLeg; receiverLeg: TxLeg } | null {
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
    const receiverLeg = legs.find(
      (l) =>
        l.accountId.startsWith("external:") &&
        l.side === "credit" &&
        l.role === "received" &&
        l.amount.token.mint === senderLeg.amount.token.mint &&
        l.accountId !== senderLeg.accountId,
    );

    if (receiverLeg) {
      const amount = senderLeg.amount.amountUi;
      if (amount > bestAmount) {
        bestAmount = amount;
        bestPair = { senderLeg, receiverLeg };
      }
    }
  }

  return bestPair;
}

export class SolanaPayClassifier implements Classifier {
  name = "solana-pay";
  priority = 95;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { tx, legs } = context;

    if (!isSolanaPayTransaction(tx.programIds, tx.memo)) {
      return null;
    }

    const memo = parseSolanaPayMemo(tx.memo!);

    const pair = findBestTransferPair(legs);

    const senderLeg = pair?.senderLeg ?? null;
    const receiverLeg = pair?.receiverLeg ?? null;

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

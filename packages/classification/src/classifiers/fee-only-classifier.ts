import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";

export class FeeOnlyClassifier implements Classifier {
  name = "fee-only";
  priority = 60;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, walletAddress } = context;

    const walletPrefix = `wallet:${walletAddress}`;

    const userLegs = legs.filter((leg) => leg.accountId.includes(walletPrefix));

    const nonFeeUserLegs = userLegs.filter((leg) => leg.role !== "fee");

    if (nonFeeUserLegs.length > 0) {
      return null;
    }

    const feeLegs = legs.filter((leg) => leg.role === "fee");

    if (feeLegs.length === 0) {
      return null;
    }

    const totalFee = feeLegs.find((leg) => leg.amount.token.symbol === "SOL");

    return {
      primaryType: "fee_only",
      direction: "outgoing",
      primaryAmount: totalFee?.amount ?? null,
      secondaryAmount: null,
      counterparty: null,
      confidence: 0.95,
      isRelevant: false,
      metadata: {
        fee_type: "network",
      },
    };
  }
}

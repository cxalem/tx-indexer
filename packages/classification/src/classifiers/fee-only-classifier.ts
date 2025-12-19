import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";

export class FeeOnlyClassifier implements Classifier {
  name = "fee-only";
  priority = 60;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs } = context;

    const externalLegs = legs.filter((leg) =>
      leg.accountId.startsWith("external:")
    );
    const nonFeeLegs = externalLegs.filter((leg) => leg.role !== "fee");

    if (nonFeeLegs.length > 0) {
      return null;
    }

    const feeLegs = legs.filter((leg) => leg.role === "fee");

    if (feeLegs.length === 0) {
      return null;
    }

    const feePayerLeg = feeLegs.find(
      (leg) => leg.side === "debit" && leg.amount.token.symbol === "SOL"
    );

    const feePayer = feePayerLeg?.accountId.replace("external:", "") ?? null;
    const totalFee = feeLegs.find((leg) => leg.amount.token.symbol === "SOL");

    return {
      primaryType: "fee_only",
      primaryAmount: totalFee?.amount ?? null,
      secondaryAmount: null,
      sender: feePayer,
      receiver: null,
      counterparty: null,
      confidence: 0.95,
      isRelevant: false,
      metadata: {
        fee_type: "network",
      },
    };
  }
}

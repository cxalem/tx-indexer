import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isStakeProtocolById } from "../protocols/detector";

export class StakeDepositClassifier implements Classifier {
  name = "stake-deposit";
  priority = 82;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const hasStakeProtocol = isStakeProtocolById(tx.protocol?.id);
    if (!hasStakeProtocol) {
      return null;
    }

    const solDebit = legs.find(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "debit" &&
        leg.amount.token.symbol === "SOL" &&
        (leg.role === "sent" || leg.role === "protocol_deposit")
    );

    if (!solDebit) {
      return null;
    }

    const staker = solDebit.accountId.replace("external:", "");

    return {
      primaryType: "stake_deposit",
      primaryAmount: solDebit.amount,
      secondaryAmount: null,
      sender: staker,
      receiver: null,
      counterparty: null,
      confidence: 0.9,
      isRelevant: true,
      metadata: {
        stake_amount: solDebit.amount.amountUi,
        protocol: tx.protocol?.id,
      },
    };
  }
}

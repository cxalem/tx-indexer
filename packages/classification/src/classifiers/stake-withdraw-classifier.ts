import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isStakeProtocolById } from "../protocols/detector";

export class StakeWithdrawClassifier implements Classifier {
  name = "stake-withdraw";
  priority = 81;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const hasStakeProtocol = isStakeProtocolById(tx.protocol?.id);
    if (!hasStakeProtocol) {
      return null;
    }

    const solCredit = legs.find(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "credit" &&
        leg.amount.token.symbol === "SOL" &&
        (leg.role === "received" || leg.role === "protocol_withdraw")
    );

    if (!solCredit) {
      return null;
    }

    const solDebit = legs.find(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "debit" &&
        leg.amount.token.symbol === "SOL" &&
        (leg.role === "sent" || leg.role === "protocol_deposit")
    );

    if (solDebit) {
      return null;
    }

    const withdrawer = solCredit.accountId.replace("external:", "");

    return {
      primaryType: "stake_withdraw",
      primaryAmount: solCredit.amount,
      secondaryAmount: null,
      sender: null,
      receiver: withdrawer,
      counterparty: null,
      confidence: 0.9,
      isRelevant: true,
      metadata: {
        withdraw_amount: solCredit.amount.amountUi,
        protocol: tx.protocol?.id,
      },
    };
  }
}

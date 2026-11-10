import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { isStakeProtocolById } from "../protocols/detector";
import { getPerspectiveAddress } from "../engine/leg-helpers";

function isSolDebit(leg: TxLeg): boolean {
  return (
    leg.accountId.startsWith("external:") &&
    leg.side === "debit" &&
    leg.amount.token.symbol === "SOL" &&
    (leg.role === "sent" || leg.role === "protocol_deposit")
  );
}

export class StakeDepositClassifier implements Classifier {
  name = "stake-deposit";
  priority = 82;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx, walletAddress } = context;

    const hasStakeProtocol = isStakeProtocolById(tx.protocol?.id);
    if (!hasStakeProtocol) {
      return null;
    }

    // Direction comes from the target wallet (or the fee payer): a debit on a
    // reserve or other third-party account is not the user's stake. Only when
    // no perspective account is known do we fall back to any external debit.
    const perspective = getPerspectiveAddress(walletAddress, tx.accountKeys);
    const solDebit = perspective
      ? legs.find(
          (leg) => isSolDebit(leg) && leg.accountId === `external:${perspective}`,
        )
      : legs.find(isSolDebit);

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

import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { isStakeProtocolById } from "../protocols/detector";
import { getPerspectiveAddress } from "../engine/leg-helpers";

function isSolCredit(leg: TxLeg): boolean {
  return (
    leg.accountId.startsWith("external:") &&
    leg.side === "credit" &&
    leg.amount.token.symbol === "SOL" &&
    (leg.role === "received" || leg.role === "protocol_withdraw")
  );
}

function isSolDebit(leg: TxLeg): boolean {
  return (
    leg.accountId.startsWith("external:") &&
    leg.side === "debit" &&
    leg.amount.token.symbol === "SOL" &&
    (leg.role === "sent" || leg.role === "protocol_deposit")
  );
}

export class StakeWithdrawClassifier implements Classifier {
  name = "stake-withdraw";
  priority = 81;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx, walletAddress } = context;

    const hasStakeProtocol = isStakeProtocolById(tx.protocol?.id);
    if (!hasStakeProtocol) {
      return null;
    }

    // Direction comes from the target wallet (or the fee payer): the wallet
    // must receive SOL and must not send SOL. Debits on a reserve or stake
    // account (the source of a withdrawal) do not veto it. Without any known
    // perspective account, fall back to the legacy any-external rule.
    const perspective = getPerspectiveAddress(walletAddress, tx.accountKeys);
    const ownId = perspective ? `external:${perspective}` : null;
    const scoped = ownId ? legs.filter((leg) => leg.accountId === ownId) : legs;

    const solCredit = scoped.find(isSolCredit);
    if (!solCredit) {
      return null;
    }

    if (scoped.some(isSolDebit)) {
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

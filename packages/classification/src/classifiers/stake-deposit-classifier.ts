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
    // reserve or other third-party account is not the user's stake.
    // - The wallet's own SOL debit is the stake.
    // - Sponsored deposit: the wallet has no SOL debit but receives the pool
    //   tokens (its participation); the amount is the actual SOL funding leg
    //   (largest external SOL debit) and the sender is the funder.
    // Only when no perspective account is known do we fall back to any
    // external debit (legacy rule).
    const perspective = getPerspectiveAddress(walletAddress, tx.accountKeys);
    let solDebit: TxLeg | undefined;
    if (!perspective) {
      solDebit = legs.find(isSolDebit);
    } else {
      const ownId = `external:${perspective}`;
      solDebit = legs.find((leg) => isSolDebit(leg) && leg.accountId === ownId);
      if (!solDebit) {
        const receivesPoolTokens = legs.some(
          (leg) =>
            leg.accountId === ownId &&
            leg.side === "credit" &&
            leg.amount.token.symbol !== "SOL",
        );
        if (receivesPoolTokens) {
          solDebit = legs
            .filter(isSolDebit)
            .reduce<TxLeg | undefined>(
              (largest, leg) =>
                !largest ||
                BigInt(leg.amount.amountRaw) > BigInt(largest.amount.amountRaw)
                  ? leg
                  : largest,
              undefined,
            );
        }
      }
    }

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

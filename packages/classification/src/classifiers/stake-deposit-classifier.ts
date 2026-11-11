import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { isStakeProtocolById } from "../protocols/detector";
import { getPerspectiveAddress, withoutUnmatchedClosedDebits } from "../engine/leg-helpers";

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
    const { tx, walletAddress } = context;
    // A debit from a token account closed in this transaction that nothing
    // receives (e.g. burn and close) is accounting, not evidence of an action.
    const legs = withoutUnmatchedClosedDebits(context.legs, tx);

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
        const ownLegs = legs.filter((leg) => leg.accountId === ownId);
        const receivesPoolTokens = ownLegs.some(
          (leg) => leg.side === "credit" && leg.amount.token.symbol !== "SOL",
        );
        // The sponsored fallback never fires when the wallet itself gains SOL
        // (net SOL credit) or gives up another token (e.g. its pool tokens
        // decreasing): those are withdrawal/redeem shapes, not deposits.
        let walletNetSol = 0n;
        for (const leg of ownLegs) {
          if (leg.amount.token.symbol !== "SOL") continue;
          const raw = BigInt(leg.amount.amountRaw);
          walletNetSol += leg.side === "credit" ? raw : -raw;
        }
        const sendsOtherToken = ownLegs.some(
          (leg) => leg.side === "debit" && leg.amount.token.symbol !== "SOL",
        );
        if (receivesPoolTokens && walletNetSol <= 0n && !sendsOtherToken) {
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

import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isStakeProtocolById } from "../protocols/detector";

/**
 * Classifies reward distributions — staking rewards, validator rewards, and protocol emissions.
 *
 * Reward transactions have a distinct pattern:
 * - The user receives tokens (credit) without sending anything of value (no debit except fees)
 * - The incoming tokens have a "reward" role
 * - Often comes from the Stake program or a known protocol
 *
 * This differs from airdrops:
 * - Rewards come from protocols the user has actively staked/deposited with
 * - Airdrops come from unknown/promotional sources
 * - Rewards are tied to staking protocols; airdrops often have no protocol context
 *
 * Priority 71 — just above airdrop (70) so that staking rewards from known
 * protocols aren't misclassified as airdrops.
 */
export class RewardClassifier implements Classifier {
  name = "reward";
  priority = 71;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    // Rewards typically come from staking protocols
    const hasStakeProtocol = isStakeProtocolById(tx.protocol?.id);
    if (!hasStakeProtocol) {
      return null;
    }

    // Look for legs explicitly tagged as "reward"
    const rewardLegs = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "credit" &&
        leg.role === "reward",
    );

    if (rewardLegs.length === 0) {
      return null;
    }

    // Make sure the user isn't also sending tokens (that would be a stake/unstake, not a reward)
    const nonFeeDebits = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "debit" &&
        leg.role !== "fee",
    );

    if (nonFeeDebits.length > 0) {
      // User is also sending tokens — this is likely a stake/unstake, not a pure reward
      return null;
    }

    // Find the primary reward (largest amount)
    const primaryReward = rewardLegs.reduce((best, leg) =>
      leg.amount.amountUi > best.amount.amountUi ? leg : best,
    );

    const receiver = primaryReward.accountId.replace("external:", "");

    // Sum total rewards if multiple tokens are rewarded
    const totalRewards = rewardLegs.map((l) => ({
      token: l.amount.token.symbol,
      amount: l.amount.amountUi,
    }));

    return {
      primaryType: "reward",
      primaryAmount: primaryReward.amount,
      secondaryAmount: null,
      sender: null,
      receiver,
      counterparty: null,
      confidence: 0.85,
      isRelevant: true,
      metadata: {
        reward_type: "staking",
        rewards: totalRewards,
        protocol: tx.protocol?.id,
      },
    };
  }
}

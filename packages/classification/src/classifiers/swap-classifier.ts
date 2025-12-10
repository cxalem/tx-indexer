import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";

export class SwapClassifier implements Classifier {
  name = "swap";
  priority = 80;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, walletAddress } = context;

    const walletPrefix = `wallet:${walletAddress}`;

    const userDebits = legs.filter(
      (leg) => leg.accountId.includes(walletPrefix) && leg.side === "debit"
    );

    const userCredits = legs.filter(
      (leg) => leg.accountId.includes(walletPrefix) && leg.side === "credit"
    );

    const userTokensOut = userDebits.filter(
      (leg) => leg.role === "sent" || leg.role === "protocol_deposit"
    );

    const userTokensIn = userCredits.filter(
      (leg) => leg.role === "received" || leg.role === "protocol_withdraw"
    );

    if (userTokensOut.length === 0 || userTokensIn.length === 0) {
      return null;
    }

    const protocolLegs = legs.filter((leg) =>
      leg.accountId.startsWith("protocol:")
    );

    if (protocolLegs.length === 0) {
      return null;
    }

    if (userTokensOut.length === 1 && userTokensIn.length === 1) {
      const tokenOut = userTokensOut[0]!;
      const tokenIn = userTokensIn[0]!;

      if (tokenOut.amount.token.symbol !== tokenIn.amount.token.symbol) {
        return {
          primaryType: "swap",
          direction: "neutral",
          primaryAmount: tokenOut.amount,
          secondaryAmount: tokenIn.amount,
          counterparty: null,
          confidence: 0.9,
          isRelevant: true,
          metadata: {
            swap_type: "token_to_token",
            from_token: tokenOut.amount.token.symbol,
            to_token: tokenIn.amount.token.symbol,
            from_amount: tokenOut.amount.amountUi,
            to_amount: tokenIn.amount.amountUi,
          },
        };
      }
    }

    return null;
  }
}

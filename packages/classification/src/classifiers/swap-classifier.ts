import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isDexProtocolById } from "../protocols/detector";

export class SwapClassifier implements Classifier {
  name = "swap";
  priority = 80;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const hasDexProtocol = isDexProtocolById(tx.protocol?.id);
    if (!hasDexProtocol) {
      return null;
    }

    const feeLeg = legs.find(
      (leg) => leg.role === "fee" && leg.side === "debit"
    );
    const initiator = feeLeg?.accountId.replace("external:", "") ?? null;

    const tokensOut = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "debit" &&
        (leg.role === "sent" || leg.role === "protocol_deposit")
    );

    const tokensIn = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "credit" &&
        (leg.role === "received" || leg.role === "protocol_withdraw")
    );

    if (tokensOut.length === 0 || tokensIn.length === 0) {
      return null;
    }

    const tokenOut = tokensOut[0]!;
    const tokenIn = tokensIn[0]!;

    if (tokenOut.amount.token.symbol === tokenIn.amount.token.symbol) {
      return null;
    }

    return {
      primaryType: "swap",
      primaryAmount: tokenOut.amount,
      secondaryAmount: tokenIn.amount,
      sender: initiator,
      receiver: initiator,
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

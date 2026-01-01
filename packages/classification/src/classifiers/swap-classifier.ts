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

    const feeLeg = legs.find(
      (leg) => leg.role === "fee" && leg.side === "debit"
    );
    const initiator = feeLeg?.accountId.replace("external:", "") ?? null;

    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    const tokensOut = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "debit" &&
        (leg.role === "sent" || leg.role === "protocol_deposit")
    );

    const tokensIn = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
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

    const hasDexProtocol = isDexProtocolById(tx.protocol?.id);
    const confidence = hasDexProtocol ? 0.95 : 0.75;

    return {
      primaryType: "swap",
      primaryAmount: tokenOut.amount,
      secondaryAmount: tokenIn.amount,
      sender: initiator,
      receiver: initiator,
      counterparty: null,
      confidence,
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

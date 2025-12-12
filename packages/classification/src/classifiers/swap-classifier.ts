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
    const { legs, walletAddress, tx } = context;

    const protocolLegs = legs.filter((leg) =>
      leg.accountId.startsWith("protocol:")
    );

    const hasDexProtocol = isDexProtocolById(tx.protocol?.id);

    if (protocolLegs.length === 0 && !hasDexProtocol) {
      return null;
    }

    const isObserverMode = !walletAddress;

    let participantPrefix: string;
    if (walletAddress) {
      participantPrefix = `wallet:${walletAddress}`;
    } else {
      const feeLeg = legs.find(
        (leg) => leg.role === "fee" && leg.accountId.startsWith("external:")
      );
      if (!feeLeg) return null;
      const feePayerAddress = feeLeg.accountId.replace("external:", "");
      participantPrefix = `external:${feePayerAddress}`;
    }

    const participantDebits = legs.filter(
      (leg) => leg.accountId.startsWith(participantPrefix) && leg.side === "debit"
    );

    const participantCredits = legs.filter(
      (leg) => leg.accountId.startsWith(participantPrefix) && leg.side === "credit"
    );

    const tokensOut = participantDebits.filter(
      (leg) => leg.role === "sent" || leg.role === "protocol_deposit"
    );

    const tokensIn = participantCredits.filter(
      (leg) => leg.role === "received" || leg.role === "protocol_withdraw"
    );

    if (tokensOut.length === 0 || tokensIn.length === 0) {
      return null;
    }

    if (tokensOut.length === 1 && tokensIn.length === 1) {
      const tokenOut = tokensOut[0]!;
      const tokenIn = tokensIn[0]!;

      if (tokenOut.amount.token.symbol !== tokenIn.amount.token.symbol) {
        return {
          primaryType: "swap",
          direction: "neutral",
          primaryAmount: tokenOut.amount,
          secondaryAmount: tokenIn.amount,
          counterparty: null,
          confidence: isObserverMode ? 0.85 : 0.9,
          isRelevant: true,
          metadata: {
            swap_type: "token_to_token",
            from_token: tokenOut.amount.token.symbol,
            to_token: tokenIn.amount.token.symbol,
            from_amount: tokenOut.amount.amountUi,
            to_amount: tokenIn.amount.amountUi,
            ...(isObserverMode && { observer_mode: true }),
          },
        };
      }
    }

    return null;
  }
}

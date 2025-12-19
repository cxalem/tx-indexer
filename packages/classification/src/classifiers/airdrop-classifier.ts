import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { detectFacilitator } from "@tx-indexer/solana/constants/program-ids";

export class AirdropClassifier implements Classifier {
  name = "airdrop";
  priority = 70;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const facilitator = tx.accountKeys
      ? detectFacilitator(tx.accountKeys)
      : null;

    const protocolLegs = legs.filter((leg) =>
      leg.accountId.startsWith("protocol:")
    );

    if (protocolLegs.length === 0) {
      return null;
    }

    const tokenReceived = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "credit" &&
        leg.role === "received" &&
        leg.amount.token.symbol !== "SOL"
    );

    if (tokenReceived.length === 0) {
      return null;
    }

    const tokenSent = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "debit" &&
        leg.role === "sent" &&
        leg.amount.token.symbol !== "SOL"
    );

    if (tokenSent.length > 0) {
      return null;
    }

    const mainToken = tokenReceived[0]!;
    const receiver = mainToken.accountId.replace("external:", "");

    const senderLeg = legs.find(
      (leg) =>
        leg.side === "debit" &&
        leg.amount.token.mint === mainToken.amount.token.mint
    );

    const sender = senderLeg
      ? senderLeg.accountId.replace(/^(external:|protocol:)/, "")
      : null;

    return {
      primaryType: "airdrop",
      primaryAmount: mainToken.amount,
      secondaryAmount: null,
      sender,
      receiver,
      counterparty: sender
        ? {
            type: "protocol",
            address: sender,
          }
        : null,
      confidence: 0.85,
      isRelevant: true,
      metadata: {
        airdrop_type: "token",
        token: mainToken.amount.token.symbol,
        amount: mainToken.amount.amountUi,
        ...(facilitator && { facilitator }),
      },
    };
  }
}

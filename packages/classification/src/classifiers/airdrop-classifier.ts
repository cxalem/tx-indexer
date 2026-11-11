import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { detectFacilitator } from "@tx-indexer/solana/constants/program-ids";

function getRawAmount(amountRaw: string): bigint {
  try {
    return BigInt(amountRaw);
  } catch {
    return 0n;
  }
}

function getLargestLeg<T extends { amount: { amountRaw: string } }>(legs: T[]): T | null {
  if (legs.length === 0) return null;
  return legs.reduce((largest, current) =>
    getRawAmount(current.amount.amountRaw) > getRawAmount(largest.amount.amountRaw)
      ? current
      : largest,
  );
}

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

    const mainToken = getLargestLeg(tokenReceived);
    if (!mainToken) {
      return null;
    }
    const receiver = mainToken.accountId.replace("external:", "");

    const protocolSenderLeg = getLargestLeg(
      legs.filter(
        (leg) =>
          leg.side === "debit" &&
          leg.accountId.startsWith("protocol:") &&
          leg.amount.token.mint === mainToken.amount.token.mint,
      ),
    );

    const fallbackSenderLeg = getLargestLeg(
      legs.filter(
        (leg) =>
          leg.side === "debit" &&
          !leg.accountId.startsWith("external:") &&
          leg.amount.token.mint === mainToken.amount.token.mint,
      ),
    );

    const senderLeg = protocolSenderLeg ?? fallbackSenderLeg;

    const sender = senderLeg
      ? senderLeg.accountId.replace(/^(external:|protocol:)/, "")
      : null;

    return {
      primaryType: "airdrop",
      primaryAmount: mainToken.amount,
      secondaryAmount: null,
      sender,
      receiver,
      counterparty:
        sender && senderLeg
          ? {
              type: senderLeg.accountId.startsWith("protocol:")
                ? "protocol"
                : "unknown",
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

import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { isBridgeProtocolById } from "../protocols/detector";

function getRawAmount(amountRaw: string): bigint {
  try {
    return BigInt(amountRaw);
  } catch {
    return 0n;
  }
}

function sumRawAmounts(legs: TxLeg[]): bigint {
  return legs.reduce((sum, leg) => sum + getRawAmount(leg.amount.amountRaw), 0n);
}

function getLargestLeg(legs: TxLeg[]): TxLeg | null {
  if (legs.length === 0) return null;
  return legs.reduce((largest, current) =>
    getRawAmount(current.amount.amountRaw) > getRawAmount(largest.amount.amountRaw)
      ? current
      : largest,
  );
}

export class BridgeClassifier implements Classifier {
  name = "bridge";
  priority = 88;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const hasBridgeProtocol = isBridgeProtocolById(tx.protocol?.id);
    if (!hasBridgeProtocol) {
      return null;
    }

    const tokensOut = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "debit" &&
        leg.role !== "fee" &&
        (leg.role === "sent" || leg.role === "protocol_deposit")
    );

    const tokensIn = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "credit" &&
        (leg.role === "received" || leg.role === "protocol_withdraw")
    );

    let primaryType: "bridge_in" | "bridge_out";
    let primaryAmount = null;
    let participant: string | null = null;

    if (tokensIn.length > 0 && tokensOut.length === 0) {
      primaryType = "bridge_in";
      const creditLeg = getLargestLeg(tokensIn);
      if (!creditLeg) return null;
      primaryAmount = creditLeg.amount;
      participant = creditLeg.accountId.replace("external:", "");
    } else if (tokensOut.length > 0 && tokensIn.length === 0) {
      primaryType = "bridge_out";
      const debitLeg = getLargestLeg(tokensOut);
      if (!debitLeg) return null;
      primaryAmount = debitLeg.amount;
      participant = debitLeg.accountId.replace("external:", "");
    } else if (tokensIn.length > 0 && tokensOut.length > 0) {
      const inRaw = sumRawAmounts(tokensIn);
      const outRaw = sumRawAmounts(tokensOut);

      if (inRaw === outRaw) {
        return null;
      }

      if (inRaw > outRaw) {
        primaryType = "bridge_in";
        const creditLeg = getLargestLeg(tokensIn);
        if (!creditLeg) return null;
        primaryAmount = creditLeg.amount;
        participant = creditLeg.accountId.replace("external:", "");
      } else {
        primaryType = "bridge_out";
        const debitLeg = getLargestLeg(tokensOut);
        if (!debitLeg) return null;
        primaryAmount = debitLeg.amount;
        participant = debitLeg.accountId.replace("external:", "");
      }
    } else {
      return null;
    }

    return {
      primaryType,
      primaryAmount,
      secondaryAmount: null,
      sender: primaryType === "bridge_out" ? participant : null,
      receiver: primaryType === "bridge_in" ? participant : null,
      counterparty: null,
      confidence: 0.9,
      isRelevant: true,
      metadata: {
        bridge_protocol: tx.protocol?.id,
        bridge_name: tx.protocol?.name,
      },
    };
  }
}

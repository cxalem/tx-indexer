import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { isDexProtocolById } from "../protocols/detector";

/**
 * Finds the best swap pair from the lists of tokens going out and coming in.
 *
 * The best pair is determined by:
 * 1. Must have different token symbols (otherwise it's not a swap)
 * 2. Prefer the pair with the largest total value (to avoid picking up dust/fees)
 *
 * For now, we use amountUi as a proxy for value since we don't have USD prices.
 * This works well because:
 * - The main swap tokens typically have much larger amounts than dust
 * - A 2000 USDC swap will always beat a 0.0002 SOL fee
 */
function findSwapPair(
  tokensOut: TxLeg[],
  tokensIn: TxLeg[],
): { initiatorOut: TxLeg; initiatorIn: TxLeg } | null {
  let bestPair: { initiatorOut: TxLeg; initiatorIn: TxLeg } | null = null;
  let bestScore = 0;

  for (const out of tokensOut) {
    for (const inLeg of tokensIn) {
      if (out.amount.token.symbol !== inLeg.amount.token.symbol) {
        // Score by the larger of the two amounts (in UI units)
        // This helps identify the "main" swap vs dust movements
        const score = Math.max(out.amount.amountUi, inLeg.amount.amountUi);

        if (score > bestScore) {
          bestScore = score;
          bestPair = { initiatorOut: out, initiatorIn: inLeg };
        }
      }
    }
  }

  return bestPair;
}

export class SwapClassifier implements Classifier {
  name = "swap";
  priority = 80;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx, walletAddress } = context;

    const initiator = tx.accountKeys?.[0] ?? null;

    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    const initiatorTokensOut = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "debit" &&
        (leg.role === "sent" || leg.role === "protocol_deposit"),
    );

    const initiatorTokensIn = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "credit" &&
        (leg.role === "received" || leg.role === "protocol_withdraw"),
    );

    if (initiatorTokensOut.length === 0 || initiatorTokensIn.length === 0) {
      return null;
    }

    const swapPair = findSwapPair(initiatorTokensOut, initiatorTokensIn);
    if (!swapPair) {
      return null;
    }

    const { initiatorOut, initiatorIn } = swapPair;

    let tokenOut = initiatorOut;
    let tokenIn = initiatorIn;
    let perspectiveWallet = initiator;

    if (walletAddress) {
      const walletAccountId = `external:${walletAddress}`;

      const walletOut = legs.find(
        (leg) =>
          leg.accountId === walletAccountId &&
          leg.side === "debit" &&
          (leg.role === "sent" || leg.role === "protocol_deposit"),
      );

      const walletIn = legs.find(
        (leg) =>
          leg.accountId === walletAccountId &&
          leg.side === "credit" &&
          (leg.role === "received" || leg.role === "protocol_withdraw"),
      );

      if (
        walletOut &&
        walletIn &&
        walletOut.amount.token.symbol !== walletIn.amount.token.symbol
      ) {
        tokenOut = walletOut;
        tokenIn = walletIn;
        perspectiveWallet = walletAddress;
      }
    }

    const hasDexProtocol = isDexProtocolById(tx.protocol?.id);
    const confidence = hasDexProtocol ? 0.95 : 0.75;

    return {
      primaryType: "swap",
      primaryAmount: tokenOut.amount,
      secondaryAmount: tokenIn.amount,
      sender: perspectiveWallet,
      receiver: perspectiveWallet,
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

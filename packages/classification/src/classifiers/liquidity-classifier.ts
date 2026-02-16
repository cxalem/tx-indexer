import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { isDexProtocolById } from "../protocols/detector";

/**
 * Classifies liquidity provision (add/remove) on AMM protocols.
 *
 * Liquidity operations on Raydium, Orca, Meteora, etc.:
 * - Add liquidity: user sends 2 tokens, receives LP token → looks like a multi-token swap
 * - Remove liquidity: user sends LP token, receives 2 tokens back
 *
 * Detection heuristic:
 * - Must involve a known DEX protocol (LP operations happen on the same programs as swaps)
 * - Add: user sends 2+ different tokens out AND receives exactly 1 token back (LP token)
 *   where the received token has a different symbol from both sent tokens
 * - Remove: user sends 1 token (LP token) AND receives 2+ different tokens back
 *
 * Priority 82 — above swap (80) to catch LP operations before the swap classifier
 * grabs them. The key differentiator is the 2-to-1 or 1-to-2 token pattern.
 */
export class LiquidityClassifier implements Classifier {
  name = "liquidity";
  priority = 82;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    // Liquidity operations happen on DEX protocols
    const hasDexProtocol = isDexProtocolById(tx.protocol?.id);
    if (!hasDexProtocol) {
      return null;
    }

    const initiator = tx.accountKeys?.[0] ?? null;
    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    // Tokens going out from the user
    const tokensOut = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "debit" &&
        leg.role !== "fee" &&
        (leg.role === "sent" || leg.role === "protocol_deposit"),
    );

    // Tokens coming in to the user
    const tokensIn = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "credit" &&
        (leg.role === "received" || leg.role === "protocol_withdraw"),
    );

    // Get unique token symbols on each side
    const uniqueOut = new Set(tokensOut.map((l) => l.amount.token.symbol));
    const uniqueIn = new Set(tokensIn.map((l) => l.amount.token.symbol));

    // Add liquidity: send 2+ different tokens, receive 1 (LP token)
    if (uniqueOut.size >= 2 && uniqueIn.size === 1) {
      return this.buildAddLiquidity(tokensOut, tokensIn, initiator, tx.protocol?.id);
    }

    // Remove liquidity: send 1 token (LP), receive 2+ different tokens
    if (uniqueOut.size === 1 && uniqueIn.size >= 2) {
      return this.buildRemoveLiquidity(tokensOut, tokensIn, initiator, tx.protocol?.id);
    }

    // Not a liquidity operation — let the swap classifier handle it
    return null;
  }

  private buildAddLiquidity(
    tokensOut: TxLeg[],
    _tokensIn: TxLeg[],
    initiator: string,
    protocolId: string | undefined,
  ): TransactionClassification {
    // Sort by amount descending to pick the primary deposit token
    const sorted = [...tokensOut].sort(
      (a, b) => b.amount.amountUi - a.amount.amountUi,
    );
    const primaryLeg = sorted[0]!;
    const secondaryLeg = sorted[1] ?? null;

    return {
      primaryType: "liquidity_add",
      primaryAmount: primaryLeg.amount,
      secondaryAmount: secondaryLeg?.amount ?? null,
      sender: initiator,
      receiver: initiator,
      counterparty: null,
      confidence: 0.85,
      isRelevant: true,
      metadata: {
        tokens_deposited: sorted.map((l) => ({
          token: l.amount.token.symbol,
          amount: l.amount.amountUi,
        })),
        protocol: protocolId,
      },
    };
  }

  private buildRemoveLiquidity(
    _tokensOut: TxLeg[],
    tokensIn: TxLeg[],
    initiator: string,
    protocolId: string | undefined,
  ): TransactionClassification {
    // Sort by amount descending to pick the primary received token
    const sorted = [...tokensIn].sort(
      (a, b) => b.amount.amountUi - a.amount.amountUi,
    );
    const primaryLeg = sorted[0]!;
    const secondaryLeg = sorted[1] ?? null;

    return {
      primaryType: "liquidity_remove",
      primaryAmount: primaryLeg.amount,
      secondaryAmount: secondaryLeg?.amount ?? null,
      sender: initiator,
      receiver: initiator,
      counterparty: null,
      confidence: 0.85,
      isRelevant: true,
      metadata: {
        tokens_received: sorted.map((l) => ({
          token: l.amount.token.symbol,
          amount: l.amount.amountUi,
        })),
        protocol: protocolId,
      },
    };
  }
}

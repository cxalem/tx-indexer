import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { isLendingProtocolById } from "../protocols/detector";

/**
 * Classifies lending protocol deposits and withdrawals.
 *
 * Lending protocols (Marginfi, Solend, Kamino, Save) allow users to:
 * - Deposit tokens to earn yield → `token_deposit`
 * - Withdraw tokens from lending positions → `token_withdraw`
 *
 * Detection pattern:
 * - Must involve a known lending protocol
 * - Deposit: user sends tokens to protocol (debit) with no significant credit back
 *   (or receives a receipt/cToken which has a different symbol)
 * - Withdraw: user receives tokens from protocol (credit) with no significant debit
 *   (or sends back a receipt/cToken)
 *
 * Priority 83 — above swap (80) because lending deposits can look like swaps
 * (deposit SOL → receive cSOL), but the intent is different.
 */
export class LendingClassifier implements Classifier {
  name = "lending";
  priority = 83;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const hasLendingProtocol = isLendingProtocolById(tx.protocol?.id);
    if (!hasLendingProtocol) {
      return null;
    }

    const initiator = tx.accountKeys?.[0] ?? null;
    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    // Tokens going out from the user (deposits into the protocol)
    const tokensOut = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "debit" &&
        leg.role !== "fee" &&
        (leg.role === "sent" || leg.role === "protocol_deposit"),
    );

    // Tokens coming in to the user (withdrawals from the protocol)
    const tokensIn = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "credit" &&
        (leg.role === "received" || leg.role === "protocol_withdraw"),
    );

    // Determine if this is a deposit or withdrawal
    const classification = this.classifyDirection(
      tokensOut,
      tokensIn,
      initiator,
      tx.protocol?.id,
    );

    return classification;
  }

  private classifyDirection(
    tokensOut: TxLeg[],
    tokensIn: TxLeg[],
    initiator: string,
    protocolId: string | undefined,
  ): TransactionClassification | null {
    const hasTokensOut = tokensOut.length > 0;
    const hasTokensIn = tokensIn.length > 0;

    if (!hasTokensOut && !hasTokensIn) {
      return null;
    }

    // Deposit: user sends tokens, may receive a receipt token (cToken/mToken)
    // The primary leg is the one being deposited, not the receipt
    if (hasTokensOut && !hasTokensIn) {
      const primaryLeg = this.findPrimaryLeg(tokensOut);
      return this.buildResult("token_deposit", primaryLeg, initiator, protocolId);
    }

    // Withdraw: user receives tokens, may send back a receipt token
    if (hasTokensIn && !hasTokensOut) {
      const primaryLeg = this.findPrimaryLeg(tokensIn);
      return this.buildResult("token_withdraw", primaryLeg, initiator, protocolId);
    }

    // Both sides present — determine by net flow
    // If user sends token A and receives token B (receipt), it's a deposit
    // If user sends receipt token and receives token A, it's a withdraw
    if (hasTokensOut && hasTokensIn) {
      const totalOut = tokensOut.reduce(
        (sum, leg) => sum + leg.amount.amountUi,
        0,
      );
      const totalIn = tokensIn.reduce(
        (sum, leg) => sum + leg.amount.amountUi,
        0,
      );

      // Net outflow = deposit, net inflow = withdraw
      // Use the larger side as primary
      if (totalOut >= totalIn) {
        const primaryLeg = this.findPrimaryLeg(tokensOut);
        return this.buildResult("token_deposit", primaryLeg, initiator, protocolId);
      } else {
        const primaryLeg = this.findPrimaryLeg(tokensIn);
        return this.buildResult("token_withdraw", primaryLeg, initiator, protocolId);
      }
    }

    return null;
  }

  /**
   * Finds the primary (largest) leg from a list, preferring non-SOL tokens
   * since SOL movements are often just for account rent or fees.
   */
  private findPrimaryLeg(legs: TxLeg[]): TxLeg {
    return legs.reduce((best, leg) => {
      const bestIsSol =
        best.amount.token.symbol === "SOL" ||
        best.amount.token.symbol === "WSOL";
      const legIsSol =
        leg.amount.token.symbol === "SOL" ||
        leg.amount.token.symbol === "WSOL";

      // Prefer non-SOL tokens
      if (bestIsSol && !legIsSol) return leg;
      if (!bestIsSol && legIsSol) return best;

      // Same type — prefer larger amount
      return leg.amount.amountUi > best.amount.amountUi ? leg : best;
    });
  }

  private buildResult(
    primaryType: "token_deposit" | "token_withdraw",
    primaryLeg: TxLeg,
    initiator: string,
    protocolId: string | undefined,
  ): TransactionClassification {
    const isDeposit = primaryType === "token_deposit";

    return {
      primaryType,
      primaryAmount: primaryLeg.amount,
      secondaryAmount: null,
      sender: isDeposit ? initiator : null,
      receiver: isDeposit ? null : initiator,
      counterparty: null,
      confidence: 0.9,
      isRelevant: true,
      metadata: {
        amount: primaryLeg.amount.amountUi,
        token: primaryLeg.amount.token.symbol,
        protocol: protocolId,
        action: isDeposit ? "deposit" : "withdraw",
      },
    };
  }
}

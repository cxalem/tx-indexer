import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";

/**
 * Classifies fungible token burn transactions.
 *
 * Priority 72 — above reward (71) but below tip (73).
 *
 * Detects burning fungible tokens: user sends tokens (decimals > 0) as a debit
 * with no corresponding credit to any external account.
 * The tokens go to a protocol account or are destroyed on-chain.
 */
export class TokenBurnClassifier implements Classifier {
  name = "token-burn";
  priority = 72;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const initiator = tx.accountKeys?.[0] ?? null;
    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    // Find fungible token debits from the initiator (not fee, not SOL)
    const tokenDebits = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "debit" &&
        leg.role !== "fee" &&
        leg.amount.token.decimals > 0 &&
        leg.amount.token.symbol !== "SOL" &&
        leg.amount.token.symbol !== "WSOL",
    );

    if (tokenDebits.length === 0) {
      return null;
    }

    // For each token debit, check that there's NO credit to any external account for the same mint
    const burnedTokens = tokenDebits.filter((debit) => {
      const hasExternalCredit = legs.some(
        (leg) =>
          leg.accountId.startsWith("external:") &&
          leg.side === "credit" &&
          leg.amount.token.mint === debit.amount.token.mint,
      );
      return !hasExternalCredit;
    });

    if (burnedTokens.length === 0) {
      return null;
    }

    // Also make sure there are no credits at all to the initiator (otherwise it might be a swap)
    const initiatorCredits = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "credit",
    );

    if (initiatorCredits.length > 0) {
      return null;
    }

    const primaryLeg = burnedTokens.reduce((best, leg) =>
      leg.amount.amountUi > best.amount.amountUi ? leg : best,
    );

    return {
      primaryType: "token_burn",
      primaryAmount: primaryLeg.amount,
      secondaryAmount: null,
      sender: initiator,
      receiver: null,
      counterparty: null,
      confidence: 0.85,
      isRelevant: true,
      metadata: {
        burned_token: primaryLeg.amount.token.symbol,
        burned_amount: primaryLeg.amount.amountUi,
        tokens_burned_count: burnedTokens.length,
      },
    };
  }
}

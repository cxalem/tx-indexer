import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";

/**
 * Classifies token creation / mint transactions (e.g. Pump.fun launches, SPL token mints).
 *
 * Priority 87 — above compression (86) since token creation is a high-signal event.
 *
 * Detects when a user creates a new token: the initiator receives a large amount of
 * a previously unseen token (credit) while typically paying SOL (debit).
 * Key heuristic: the credit leg has a token with very large amountUi (initial supply)
 * that isn't SOL, and the user doesn't debit any non-SOL tokens.
 */
export class TokenCreateClassifier implements Classifier {
  name = "token-create";
  priority = 87;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    const initiator = tx.accountKeys?.[0] ?? null;
    if (!initiator) {
      return null;
    }

    const initiatorAccountId = `external:${initiator}`;

    const debits = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "debit" &&
        leg.role !== "fee",
    );

    const credits = legs.filter(
      (leg) =>
        leg.accountId === initiatorAccountId &&
        leg.side === "credit",
    );

    if (credits.length === 0) {
      return null;
    }

    // User should only pay SOL (no non-SOL debits means they're creating, not swapping)
    const nonSolDebits = debits.filter(
      (l) => l.amount.token.symbol !== "SOL" && l.amount.token.symbol !== "WSOL",
    );

    if (nonSolDebits.length > 0) {
      return null;
    }

    // Find large token credits (initial supply) that aren't SOL
    const tokenCredits = credits.filter(
      (l) =>
        l.amount.token.symbol !== "SOL" &&
        l.amount.token.symbol !== "WSOL" &&
        l.amount.token.decimals > 0,
    );

    if (tokenCredits.length === 0) {
      return null;
    }

    // Pick the largest credit (the newly minted token supply)
    const primaryLeg = tokenCredits.reduce((best, leg) =>
      leg.amount.amountUi > best.amount.amountUi ? leg : best,
    );

    // Heuristic: token creation tends to have very large initial supply (> 1000)
    if (primaryLeg.amount.amountUi < 1000) {
      return null;
    }

    return {
      primaryType: "token_create",
      primaryAmount: primaryLeg.amount,
      secondaryAmount: debits[0]?.amount ?? null,
      sender: initiator,
      receiver: null,
      counterparty: null,
      confidence: 0.8,
      isRelevant: true,
      metadata: {
        token_symbol: primaryLeg.amount.token.symbol,
        token_mint: primaryLeg.amount.token.mint,
        initial_supply: primaryLeg.amount.amountUi,
        sol_cost: debits[0]?.amount.amountUi ?? 0,
      },
    };
  }
}

import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isDexProtocolById } from "../protocols/detector";

/**
 * Classifies token migration transactions (e.g. Pump.fun graduation to Raydium).
 *
 * Priority 86 — above NFT mints (85).
 *
 * Detects when a bonding-curve token graduates / migrates to a DEX pool.
 * Pattern: large token amounts move to/from protocol accounts with multiple
 * different token types involved and very large amounts (liquidity seeding).
 *
 * Key heuristic: protocol legs dominate, and token amounts are extremely large
 * (millions+), indicating pool initialization rather than user trading.
 */
export class TokenMigrateClassifier implements Classifier {
  name = "token-migrate";
  priority = 86;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    if (!isDexProtocolById(tx.protocol?.id)) {
      return null;
    }

    const initiator = tx.accountKeys?.[0] ?? null;
    if (!initiator) {
      return null;
    }

    // Protocol legs dominate in migration transactions
    const protocolLegs = legs.filter((leg) =>
      leg.accountId.startsWith("protocol:"),
    );

    if (protocolLegs.length < 2) {
      return null;
    }

    // Look for very large token amounts (liquidity seeding)
    const largeProtocolLegs = protocolLegs.filter(
      (l) =>
        l.amount.token.symbol !== "SOL" &&
        l.amount.token.symbol !== "WSOL" &&
        l.amount.amountUi >= 1_000_000,
    );

    if (largeProtocolLegs.length === 0) {
      return null;
    }

    const primaryLeg = largeProtocolLegs[0]!;

    return {
      primaryType: "token_migrate",
      primaryAmount: primaryLeg.amount,
      secondaryAmount: null,
      sender: initiator,
      receiver: null,
      counterparty: null,
      confidence: 0.75,
      isRelevant: true,
      metadata: {
        protocol: tx.protocol?.id,
        migrated_token: primaryLeg.amount.token.symbol,
        migrated_amount: primaryLeg.amount.amountUi,
      },
    };
  }
}

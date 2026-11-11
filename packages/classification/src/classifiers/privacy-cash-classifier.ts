/**
 * Privacy Cash Classifier
 *
 * Detects and classifies Privacy Cash protocol transactions.
 * Privacy Cash uses ZK-proofs to enable private transfers on Solana.
 *
 * Privacy comes from breaking the link between deposits and withdrawals.
 * Transaction data IS visible on-chain (amount, recipient, token),
 * but which deposit corresponds to which withdrawal remains private.
 *
 * Detection methods:
 * 1. Protocol-based: Transaction uses Privacy Cash program ID
 * 2. Account-based: Tokens flow from/to known Privacy Cash pool accounts
 *    (for relayer-submitted withdrawals where program isn't in tx)
 *
 * @see https://github.com/Privacy-Cash/privacy-cash-sdk
 */

import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";
import { isPrivacyCashProtocolById } from "../protocols/detector";
import {
  PRIVACY_CASH_SPL_POOL,
  PRIVACY_CASH_FEE_RECIPIENT,
} from "@tx-indexer/solana/constants/program-ids";

/**
 * Known Privacy Cash supported token mints for metadata enrichment
 */
const PRIVACY_CASH_SUPPORTED_MINTS: Record<string, string> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "USDT",
  oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp: "ORE",
  A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS: "ZEC",
  sTorERYB6xAZ1SSbwpK3zoK2EEwbBrc7TZAzg1uCGiH: "stORE",
};

function getTokenType(leg: TxLeg): "SOL" | "SPL" {
  const symbol = leg.amount.token.symbol;
  // SOL has no mint address or uses the native mint
  if (symbol === "SOL" || !leg.amount.token.mint) {
    return "SOL";
  }
  return "SPL";
}

function getLargestLeg(legs: TxLeg[]): TxLeg | null {
  if (legs.length === 0) return null;

  return legs.reduce((largest, current) =>
    current.amount.amountUi > largest.amount.amountUi ? current : largest,
  );
}

/**
 * Check if any leg involves a Privacy Cash pool account.
 * This catches relayer-submitted withdrawals where the program ID
 * might not be in the transaction's program list.
 */
function hasPrivacyCashPoolAccount(legs: TxLeg[]): boolean {
  const privacyCashAccounts = new Set([
    PRIVACY_CASH_SPL_POOL,
    PRIVACY_CASH_FEE_RECIPIENT,
  ]);

  return legs.some((leg) => {
    const address = leg.accountId.replace(/^(external|wallet|protocol):/, "");
    return privacyCashAccounts.has(address);
  });
}

/**
 * Check if a leg is from/to a Privacy Cash pool account.
 */
function isPrivacyCashPoolLeg(leg: TxLeg): boolean {
  const address = leg.accountId.replace(/^(external|wallet|protocol):/, "");
  return (
    address === PRIVACY_CASH_SPL_POOL || address === PRIVACY_CASH_FEE_RECIPIENT
  );
}

export class PrivacyCashClassifier implements Classifier {
  name = "privacy-cash";
  priority = 86;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    // Detect Privacy Cash transactions by:
    // 1. Protocol ID match (shield/deposit transactions)
    // 2. Pool account involvement (relayer-submitted unshield/withdraw)
    const isPrivacyCashProtocol = isPrivacyCashProtocolById(tx.protocol?.id);
    const hasPoolAccount = hasPrivacyCashPoolAccount(legs);

    if (!isPrivacyCashProtocol && !hasPoolAccount) {
      return null;
    }

    // Filter legs: user debits are outflows from non-pool accounts
    const userDebits = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "debit" &&
        leg.role !== "fee" &&
        !isPrivacyCashPoolLeg(leg),
    );

    // User credits are inflows to non-pool accounts
    const userCredits = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "credit" &&
        leg.role !== "fee" &&
        !isPrivacyCashPoolLeg(leg),
    );

    // Check if tokens are coming FROM the pool (withdrawal/unshield)
    const poolDebits = legs.filter(
      (leg) => isPrivacyCashPoolLeg(leg) && leg.side === "debit",
    );

    let primaryType: "privacy_deposit" | "privacy_withdraw";
    let primaryLeg: TxLeg | null = null;
    let participant: string | null = null;

    // Detection logic:
    // 1. If pool has debits (sends tokens) -> withdrawal/unshield
    // 2. If user has debits (sends tokens) -> deposit/shield
    // 3. Mixed case: compare amounts to determine primary operation

    if (poolDebits.length > 0 && userCredits.length > 0) {
      // Tokens flowing FROM pool TO user = withdrawal/unshield
      primaryType = "privacy_withdraw";
      primaryLeg = getLargestLeg(userCredits);
      if (primaryLeg) {
        participant = primaryLeg.accountId.replace("external:", "");
      }
    } else if (userDebits.length > 0 && userCredits.length === 0) {
      // User sending tokens, not receiving = deposit/shield
      primaryType = "privacy_deposit";
      primaryLeg = getLargestLeg(userDebits);
      if (primaryLeg) {
        participant = primaryLeg.accountId.replace("external:", "");
      }
    } else if (userCredits.length > 0 && userDebits.length === 0) {
      // User receiving tokens, not sending = withdrawal/unshield
      primaryType = "privacy_withdraw";
      primaryLeg = getLargestLeg(userCredits);
      if (primaryLeg) {
        participant = primaryLeg.accountId.replace("external:", "");
      }
    } else if (userCredits.length > 0 && userDebits.length > 0) {
      // Mixed case: compare amounts
      const largestDebit = getLargestLeg(userDebits);
      const largestCredit = getLargestLeg(userCredits);

      if (
        largestCredit &&
        largestDebit &&
        largestCredit.amount.amountUi > largestDebit.amount.amountUi
      ) {
        primaryType = "privacy_withdraw";
        primaryLeg = largestCredit;
      } else if (largestDebit) {
        primaryType = "privacy_deposit";
        primaryLeg = largestDebit;
      } else {
        return null;
      }

      if (primaryLeg) {
        participant = primaryLeg.accountId.replace("external:", "");
      }
    } else {
      return null;
    }

    if (!primaryLeg) {
      return null;
    }

    const tokenType = getTokenType(primaryLeg);
    const tokenMint = primaryLeg.amount.token.mint;
    const tokenSymbol = primaryLeg.amount.token.symbol;

    const isKnownToken =
      tokenType === "SOL" ||
      (tokenMint !== undefined && tokenMint in PRIVACY_CASH_SUPPORTED_MINTS);

    const feeLeg = legs.find(
      (leg) => leg.role === "fee" && leg.side === "debit",
    );
    const feeAmount = feeLeg?.amount.amountUi;

    return {
      primaryType,
      primaryAmount: primaryLeg.amount,
      secondaryAmount: null,
      sender: primaryType === "privacy_deposit" ? participant : null,
      receiver: primaryType === "privacy_withdraw" ? participant : null,
      counterparty: {
        type: "protocol",
        address: tx.protocol?.id ?? "privacy-cash",
        name: "Privacy Cash",
      },
      confidence: isKnownToken ? 0.95 : 0.85,
      isRelevant: true,
      metadata: {
        privacy_protocol: "privacy-cash",
        privacy_operation:
          primaryType === "privacy_deposit" ? "shield" : "unshield",
        token_type: tokenType,
        token_symbol: tokenSymbol,
        ...(tokenMint && { token_mint: tokenMint }),
        ...(feeAmount !== undefined && { fee_amount: feeAmount }),
        is_supported_token: isKnownToken,
      },
    };
  }
}

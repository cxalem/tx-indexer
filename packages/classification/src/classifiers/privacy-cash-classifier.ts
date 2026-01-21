/**
 * Privacy Cash Classifier
 *
 * Detects and classifies Privacy Cash protocol transactions.
 * Privacy Cash uses ZK-proofs to enable private transfers on Solana.
 *
 * =============================================================================
 * HACKATHON: Solana Privacy Hack 2026
 * BOUNTY: Privacy Cash - $15,000 (Best Integration to Existing App: $6,000)
 * DOCS: https://github.com/Privacy-Cash/privacy-cash-sdk
 * =============================================================================
 *
 * PROTOCOL DETAILS:
 * - Program ID (Mainnet): 9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD
 * - Program ID (Devnet): ATZj4jZ4FFzkvAcvk27DW9GRkgSbFnHo49fKKPQXU7VS
 *
 * INSTRUCTION DISCRIMINATORS (first 8 bytes):
 * - transact (SOL): d99582f8dd34fc77
 * - transact_spl (SPL tokens): 9a42f4cc4ee1a397
 *
 * TRANSACTION TYPE DETECTION:
 * - Deposit (shield): ext_amount > 0 (funds entering privacy pool)
 * - Withdraw (unshield): ext_amount < 0 (funds leaving privacy pool)
 *
 * SUPPORTED TOKENS:
 * - SOL (native)
 * - USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
 * - USDT: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
 *
 * =============================================================================
 * IMPLEMENTATION TODOS:
 * =============================================================================
 */

import type {
  Classifier,
  ClassifierContext,
} from "../engine/classifier.interface";
import type { TransactionClassification } from "@tx-indexer/core/tx/classification.types";
import { isPrivacyCashProtocolById } from "../protocols/detector";

export class PrivacyCashClassifier implements Classifier {
  name = "privacy-cash";
  // Priority: Higher than transfers (20), lower than bridges (88)
  // Privacy transactions should be detected before falling back to generic transfer
  priority = 85;

  classify(context: ClassifierContext): TransactionClassification | null {
    const { legs, tx } = context;

    // ==========================================================================
    // TODO 1: Check if this is a Privacy Cash transaction
    // ==========================================================================
    // Use the isPrivacyCashProtocolById helper to check tx.protocol?.id
    // If not a Privacy Cash transaction, return null early
    //
    // Example:
    // if (!isPrivacyCashProtocolById(tx.protocol?.id)) {
    //   return null;
    // }

    const isPrivacyCash = isPrivacyCashProtocolById(tx.protocol?.id);
    if (!isPrivacyCash) {
      return null;
    }

    // ==========================================================================
    // TODO 2: Parse instruction data to determine transaction type
    // ==========================================================================
    // The instruction discriminator tells us if it's SOL or SPL token operation
    // - d99582f8dd34fc77 = transact (SOL)
    // - 9a42f4cc4ee1a397 = transact_spl (SPL tokens)
    //
    // You may need to access the raw instruction data from tx
    // For now, we'll use leg analysis as a fallback

    // ==========================================================================
    // TODO 3: Determine if deposit or withdraw based on fund flow
    // ==========================================================================
    // Analyze legs to determine direction:
    // - Deposit (shield): User sends funds TO the protocol (debit from external)
    // - Withdraw (unshield): User receives funds FROM the protocol (credit to external)
    //
    // Look for legs with:
    // - accountId starting with "external:" (user accounts)
    // - side: "debit" for deposits, "credit" for withdrawals
    // - role: "sent" or "protocol_deposit" for deposits
    // - role: "received" or "protocol_withdraw" for withdrawals

    const deposits = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "debit" &&
        leg.role !== "fee",
    );

    const withdrawals = legs.filter(
      (leg) =>
        leg.accountId.startsWith("external:") &&
        leg.side === "credit" &&
        leg.role !== "fee",
    );

    // ==========================================================================
    // TODO 4: Classify the transaction type
    // ==========================================================================
    // Based on the analysis above, determine:
    // - "privacy_deposit" if funds are being shielded
    // - "privacy_withdraw" if funds are being unshielded
    //
    // Note: Internal shielded transfers (user to user within the pool) may not
    // be detectable on-chain since they use ZK-proofs

    let primaryType: "privacy_deposit" | "privacy_withdraw";
    let primaryAmount = null;
    let participant: string | null = null;

    if (deposits.length > 0 && withdrawals.length === 0) {
      // Funds going INTO the privacy pool = deposit/shield
      primaryType = "privacy_deposit";
      const depositLeg = deposits[0]!;
      primaryAmount = depositLeg.amount;
      participant = depositLeg.accountId.replace("external:", "");
    } else if (withdrawals.length > 0 && deposits.length === 0) {
      // Funds coming OUT of the privacy pool = withdraw/unshield
      primaryType = "privacy_withdraw";
      const withdrawLeg = withdrawals[0]!;
      primaryAmount = withdrawLeg.amount;
      participant = withdrawLeg.accountId.replace("external:", "");
    } else if (deposits.length > 0 && withdrawals.length > 0) {
      // Both deposit and withdrawal - likely a withdraw to different address
      // Treat as withdraw since funds are leaving to external
      primaryType = "privacy_withdraw";
      const withdrawLeg = withdrawals[0]!;
      primaryAmount = withdrawLeg.amount;
      participant = withdrawLeg.accountId.replace("external:", "");
    } else {
      // No clear fund movement detected - might be internal or admin tx
      return null;
    }

    // ==========================================================================
    // TODO 5: Extract additional metadata
    // ==========================================================================
    // Consider extracting:
    // - Token type (SOL vs SPL)
    // - Token mint address for SPL tokens
    // - Commitment hash (if accessible)
    // - Fee information

    return {
      primaryType,
      primaryAmount,
      secondaryAmount: null,
      sender: primaryType === "privacy_deposit" ? participant : null,
      receiver: primaryType === "privacy_withdraw" ? participant : null,
      counterparty: null,
      confidence: 0.9,
      isRelevant: true,
      metadata: {
        privacy_protocol: "privacy-cash",
        privacy_operation:
          primaryType === "privacy_deposit" ? "shield" : "unshield",
        // TODO: Add token_type: "SOL" | "SPL"
        // TODO: Add token_mint for SPL tokens
      },
    };
  }
}

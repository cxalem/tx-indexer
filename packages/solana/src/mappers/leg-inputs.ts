import type { RawTransaction } from "@tx-indexer/core/tx/tx.types";
import type { LegInputs } from "@tx-indexer/core/tx/leg-inputs";
import { transactionToLegs } from "./transaction-to-legs";
import { transactionToLegs as transactionToLegsV1Main } from "./legacy-v1-main/transaction-to-legs";

/**
 * Builds both leg views of a transaction for ONE wallet perspective.
 *
 * DEX account tagging depends on the wallet, so both views are built with the same
 * `walletAddress` and must never be cached by signature alone.
 *
 * - `"v2-closed-token-accounts"`: the truthful legs (what `transactionToLegs` returns and
 *   what SDK users receive).
 * - `"v1-main"`: the legs as built at 3111fd7, the compatibility input for classifiers not
 *   yet migrated (see `legacy-v1-main/`). Pass it as `{ legacyLegs }` to
 *   `classifyTransaction`.
 */
export function transactionToLegInputs(
  tx: RawTransaction,
  walletAddress?: string,
): LegInputs {
  return {
    "v2-closed-token-accounts": transactionToLegs(tx, walletAddress),
    "v1-main": transactionToLegsV1Main(tx, walletAddress),
  };
}

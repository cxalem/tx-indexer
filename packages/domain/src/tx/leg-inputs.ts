/**
 * Named, versioned leg inputs for classifiers.
 *
 * - `v1-main`: the `legs` the SDK returns and classifies, built by
 *   packages/solana/src/mappers/transaction-to-legs.ts exactly as in 1.6.x (commit 3111fd7).
 *   Every classifier reads it today.
 * - `v2-closed-token-accounts`: the complete legs (optional `completeLegs` field): all balance
 *   movements, including token accounts closed in the transaction, with `closedTokenAccount`
 *   provenance on proven closures. Built by mappers/complete-legs/. Read by no classifier and
 *   not by the list filter yet; a classifier moves to it only when migrated on evidence.
 *
 * Reserved for later, not implemented: `v3-fee-separated`.
 */
export type LegInputVersion = "v1-main" | "v2-closed-token-accounts";

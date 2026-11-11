import type { TxLeg } from "./tx.types";

/**
 * Named, versioned leg inputs for classifiers.
 *
 * The SDK publishes one truthful set of legs. Classifiers that were calibrated on an
 * older leg construction keep receiving exactly that construction until they are
 * migrated on evidence. Each classifier declares the version it reads.
 *
 * - `v1-main`: token and SOL legs exactly as built at commit 3111fd7 (post-only token
 *   extraction, owner/mint changes netted, UI-sign decisions, missing owner -> mint).
 *   A compatibility input, never returned to SDK users.
 * - `v2-closed-token-accounts`: the truthful legs returned to SDK users (union of pre and
 *   post token balances, `closedTokenAccount` provenance, owner/mint splits, raw-sign
 *   decisions, token-account owner fallback).
 *
 * Reserved for later, not implemented: `v3-fee-separated`.
 */
export type LegInputVersion = "v1-main" | "v2-closed-token-accounts";

export const LEGACY_LEG_INPUT: LegInputVersion = "v1-main";
export const CURRENT_LEG_INPUT: LegInputVersion = "v2-closed-token-accounts";

/** Both leg views of one transaction, built for one wallet perspective. */
export type LegInputs = Record<LegInputVersion, TxLeg[]>;

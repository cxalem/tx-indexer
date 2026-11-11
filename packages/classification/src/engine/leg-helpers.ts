import type { Address } from "@solana/kit";
import type { TxLeg } from "@tx-indexer/core/tx/tx.types";

export function getUserLegs(legs: TxLeg[], walletAddress: Address): TxLeg[] {
  const walletAccountId = `wallet:${walletAddress}`;
  const externalAccountId = `external:${walletAddress}`;
  return legs.filter(
    (leg) =>
      leg.accountId === walletAccountId || leg.accountId === externalAccountId,
  );
}

export function getUserDebits(legs: TxLeg[], walletAddress: Address): TxLeg[] {
  return getUserLegs(legs, walletAddress).filter((leg) => leg.side === "debit");
}

export function getUserCredits(legs: TxLeg[], walletAddress: Address): TxLeg[] {
  return getUserLegs(legs, walletAddress).filter(
    (leg) => leg.side === "credit"
  );
}

export function getProtocolLegs(legs: TxLeg[]): TxLeg[] {
  return legs.filter((leg) => leg.accountId.startsWith("protocol:"));
}

export function getExternalLegs(legs: TxLeg[]): TxLeg[] {
  return legs.filter((leg) => leg.accountId.startsWith("external:"));
}

export function getFeeLegs(legs: TxLeg[]): TxLeg[] {
  return legs.filter((leg) => leg.role === "fee");
}

export function getLegsByToken(legs: TxLeg[], tokenSymbol: string): TxLeg[] {
  return legs.filter((leg) => leg.amount.token.symbol === tokenSymbol);
}

export function getLegsByRole(legs: TxLeg[], role: string): TxLeg[] {
  return legs.filter((leg) => leg.role === role);
}

export function groupLegsByToken(legs: TxLeg[]): Map<string, TxLeg[]> {
  const grouped = new Map<string, TxLeg[]>();

  for (const leg of legs) {
    const symbol = leg.amount.token.symbol;
    const existing = grouped.get(symbol) || [];
    grouped.set(symbol, [...existing, leg]);
  }

  return grouped;
}

export function hasMultipleTokens(legs: TxLeg[]): boolean {
  const tokens = new Set(legs.map((leg) => leg.amount.token.symbol));
  return tokens.size > 1;
}

export function isMultiPartyTransaction(legs: TxLeg[]): boolean {
  const externalLegs = getExternalLegs(legs);
  const uniqueExternalAccounts = new Set(
    externalLegs.map((leg) => leg.accountId)
  );
  return uniqueExternalAccounts.size > 1;
}

export function getTotalAmount(legs: TxLeg[], tokenSymbol: string): number {
  return legs
    .filter((leg) => leg.amount.token.symbol === tokenSymbol)
    .reduce((sum, leg) => sum + leg.amount.amountUi, 0);
}

export function getNetChange(
  legs: TxLeg[],
  walletAddress: Address,
  tokenSymbol: string
): number {
  const userLegs = getUserLegs(legs, walletAddress);
  const tokenLegs = getLegsByToken(userLegs, tokenSymbol);

  let net = 0;
  for (const leg of tokenLegs) {
    if (leg.side === "credit") {
      net += leg.amount.amountUi;
    } else {
      net -= leg.amount.amountUi;
    }
  }

  return net;
}

/**
 * The account whose movements decide direction: the explicit target wallet,
 * falling back to the fee payer (`accountKeys[0]`). Null when neither is known.
 */
export function getPerspectiveAddress(
  walletAddress: string | undefined,
  accountKeys: readonly string[] | undefined,
): string | null {
  return walletAddress ?? accountKeys?.[0] ?? null;
}

/** True when some leg (any account) credits the leg's mint. */
export function hasSameMintCredit(leg: TxLeg, legs: readonly TxLeg[]): boolean {
  const mint = leg.amount.token.mint;
  return legs.some((l) => l.side === "credit" && l.amount.token.mint === mint);
}

/**
 * Debits from a token account this transaction closed that nothing in the
 * transaction receives (e.g. burn and close): debit legs carrying
 * `closedTokenAccount` (set by the SDK mapper only for a proven closure) whose
 * mint has no credit on any leg. Accounting keeps these legs; classifiers must
 * not use them as evidence for an action (not a send, a swap input, a privacy
 * deposit, or "another token sent").
 *
 * Decided from the legs alone. Legs without `closedTokenAccount` (hand-built
 * legs, legs from older mappers, any account that was not closed) are never
 * selected.
 */
export function unmatchedClosedAccountDebits(legs: readonly TxLeg[]): Set<TxLeg> {
  const out = new Set<TxLeg>();
  for (const leg of legs) {
    if (leg.side !== "debit" || leg.closedTokenAccount === undefined) continue;
    if (hasSameMintCredit(leg, legs)) continue;
    out.add(leg);
  }
  return out;
}

/** `legs` without unmatched closed-account debits (see unmatchedClosedAccountDebits). */
export function withoutUnmatchedClosedDebits(legs: TxLeg[]): TxLeg[] {
  const drop = unmatchedClosedAccountDebits(legs);
  return drop.size === 0 ? legs : legs.filter((l) => !drop.has(l));
}

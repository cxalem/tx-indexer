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

/**
 * Debits from token accounts this transaction closed that the transaction does not account
 * for (e.g. burn and close). A closed account's debit is "matched" only when the mint's
 * supply is conserved in the legs: the credits of that mint on all legs add up to at
 * least its debits. Otherwise some of the mint left circulation (burned) and every
 * closed-account debit of that mint (legs carrying `closedTokenAccount`, set by the SDK
 * mapper only for a proven closure) is returned: none of them is evidence for an action.
 *
 * Why conservation and not "any credit of the mint": an unrelated credit of the same mint
 * (a mint to someone else) must not let a burned debit through, and a closed sibling burned
 * beside a real sale must not change the sale's amount. Excluding closed-account debits
 * only moves the input back towards what classifiers saw before those debits were visible.
 * A sale whose credits fall short of the debit (e.g. a Token-2022 transfer fee withheld, or
 * a counterparty account missing from the snapshots) is excluded too; documented limitation.
 *
 * Decided from the legs alone. Legs without `closedTokenAccount` (hand-built legs, any
 * account that was not closed) are never returned.
 */
export function unmatchedClosedAccountDebits(legs: readonly TxLeg[]): Set<TxLeg> {
  const out = new Set<TxLeg>();
  const closedMints = new Set(
    legs
      .filter((l) => l.side === "debit" && l.closedTokenAccount !== undefined)
      .map((l) => l.amount.token.mint),
  );
  for (const mint of closedMints) {
    let credits = 0n;
    let debits = 0n;
    for (const l of legs) {
      if (l.amount.token.mint !== mint) continue;
      const raw = BigInt(l.amount.amountRaw);
      if (l.side === "credit") credits += raw;
      else debits += raw;
    }
    if (credits >= debits) continue;
    for (const l of legs) {
      if (l.side === "debit" && l.closedTokenAccount !== undefined && l.amount.token.mint === mint) {
        out.add(l);
      }
    }
  }
  return out;
}

/** `legs` without unmatched closed-account debits (see unmatchedClosedAccountDebits). */
export function withoutUnmatchedClosedDebits(legs: TxLeg[]): TxLeg[] {
  const drop = unmatchedClosedAccountDebits(legs);
  return drop.size === 0 ? legs : legs.filter((l) => !drop.has(l));
}

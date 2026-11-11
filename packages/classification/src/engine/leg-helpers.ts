import type { Address } from "@solana/kit";
import type { RawTransaction, TxLeg } from "@tx-indexer/core/tx/tx.types";

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


const NATIVE_MINT = "So11111111111111111111111111111111111111112";

function legAddress(accountId: string): string {
  return accountId.slice(accountId.lastIndexOf(":") + 1);
}

/** True when some leg (any account) credits the leg's mint. */
export function hasSameMintCredit(leg: TxLeg, legs: readonly TxLeg[]): boolean {
  const mint = leg.amount.token.mint;
  return legs.some((l) => l.side === "credit" && l.amount.token.mint === mint);
}

/**
 * `owner|mint` of every non-native token account whose pre side ends in this
 * transaction: closed (pre entry only), or the pre side of an owner/mint change
 * on the same index. Owner falls back to the token account address, as in the
 * legs. Empty when either token balance snapshot is unavailable.
 */
function closedAccountKeys(tx: RawTransaction): Set<string> {
  const keys = new Set<string>();
  const pre = tx.preTokenBalances;
  const post = tx.postTokenBalances;
  if (!pre || !post) return keys;
  const postByIndex = new Map(post.map((b) => [b.accountIndex, b]));
  for (const b of pre) {
    if (b.mint === NATIVE_MINT) continue;
    const p = postByIndex.get(b.accountIndex);
    const ended =
      !p ||
      p.mint !== b.mint ||
      (p.owner !== undefined && b.owner !== undefined && p.owner !== b.owner);
    if (!ended) continue;
    const owner = b.owner || tx.accountKeys?.[b.accountIndex];
    if (owner) keys.add(`${owner}|${b.mint}`);
  }
  return keys;
}

/**
 * Debits from a closed token account that nothing in the transaction receives:
 * a non-native debit, attributed to the owner of an account whose pre side ends
 * here, with no credit of the same mint on any account (e.g. burn and close).
 * Accounting keeps these legs; classifiers must not use them as the sole
 * evidence for an action (they are not a send, a swap input, a bridge or
 * privacy deposit, or "another token sent").
 */
export function unmatchedClosedAccountDebits(
  legs: readonly TxLeg[],
  tx: RawTransaction,
): Set<TxLeg> {
  const out = new Set<TxLeg>();
  const closed = closedAccountKeys(tx);
  if (closed.size === 0) return out;
  for (const leg of legs) {
    if (leg.side !== "debit" || leg.role === "fee") continue;
    const mint = leg.amount.token.mint;
    if (mint === NATIVE_MINT) continue;
    if (!closed.has(`${legAddress(leg.accountId)}|${mint}`)) continue;
    if (hasSameMintCredit(leg, legs)) continue;
    out.add(leg);
  }
  return out;
}

/** `legs` without unmatched closed-account debits (see unmatchedClosedAccountDebits). */
export function withoutUnmatchedClosedDebits(
  legs: TxLeg[],
  tx: RawTransaction,
): TxLeg[] {
  const drop = unmatchedClosedAccountDebits(legs, tx);
  return drop.size === 0 ? legs : legs.filter((l) => !drop.has(l));
}

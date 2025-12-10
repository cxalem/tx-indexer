import type { TxLeg } from "@tx-indexer/core/tx/tx.types";

export function getUserLegs(legs: TxLeg[], walletAddress: string): TxLeg[] {
  const walletPrefix = `wallet:${walletAddress}`;
  return legs.filter((leg) => leg.accountId.includes(walletPrefix));
}

export function getUserDebits(legs: TxLeg[], walletAddress: string): TxLeg[] {
  return getUserLegs(legs, walletAddress).filter((leg) => leg.side === "debit");
}

export function getUserCredits(legs: TxLeg[], walletAddress: string): TxLeg[] {
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
  walletAddress: string,
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

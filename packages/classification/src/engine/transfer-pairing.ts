import type { TxLeg } from "@tx-indexer/core/tx/tx.types";

const TINY_SOL_THRESHOLD_UI = 0.01;

export interface TransferPair {
  senderLeg: TxLeg;
  receiverLeg: TxLeg;
}

function toRawAmount(leg: TxLeg): bigint {
  try {
    return BigInt(leg.amount.amountRaw);
  } catch {
    return 0n;
  }
}

function isExternalAccount(accountId: string): boolean {
  return accountId.startsWith("external:");
}

export function isTinySolMovement(leg: TxLeg): boolean {
  return (
    (leg.amount.token.symbol === "SOL" || leg.amount.token.symbol === "WSOL") &&
    leg.amount.amountUi < TINY_SOL_THRESHOLD_UI
  );
}

function scoreTransferPair(senderLeg: TxLeg, receiverLeg: TxLeg): number {
  const exactRawAmount = toRawAmount(senderLeg) === toRawAmount(receiverLeg);
  const transferUi = Math.min(senderLeg.amount.amountUi, receiverLeg.amount.amountUi);
  const tinySolPenalty =
    isTinySolMovement(senderLeg) || isTinySolMovement(receiverLeg) ? -1000 : 0;
  const exactAmountBonus = exactRawAmount ? 500 : 0;

  return transferUi + exactAmountBonus + tinySolPenalty;
}

/**
 * Finds the best sender/receiver pair among external legs.
 *
 * @param preferAccount - Optional target wallet. When at least one candidate
 *   pair has this wallet as sender or receiver, only such pairs are
 *   considered, so movements between third-party accounts (e.g. pool vaults
 *   resolved from lookup tables) cannot displace the wallet's own transfer.
 *   When no pair involves the wallet, all pairs are considered as before.
 */
export function findBestExternalTransferPair(
  legs: TxLeg[],
  senderRoles: Array<TxLeg["role"]> = ["sent"],
  receiverRoles: Array<TxLeg["role"]> = ["received"],
  preferAccount?: string | null,
): TransferPair | null {
  if (preferAccount) {
    const preferredId = `external:${preferAccount}`;
    const involvesWallet = (pair: TransferPair) =>
      pair.senderLeg.accountId === preferredId ||
      pair.receiverLeg.accountId === preferredId;
    const preferred = findBestPair(
      legs,
      senderRoles,
      receiverRoles,
      involvesWallet,
      scoreWalletPair,
    );
    if (preferred) return preferred;
  }
  return findBestPair(
    legs,
    senderRoles,
    receiverRoles,
    () => true,
    scoreTransferPair,
  );
}

/**
 * Score for pairs that involve the target wallet: the counterpart whose
 * amount is closest to the wallet's own movement wins (an exact match first),
 * instead of the largest amount, so a large unrelated credit elsewhere cannot
 * be taken as the wallet's counterparty.
 */
function scoreWalletPair(senderLeg: TxLeg, receiverLeg: TxLeg): number {
  const a = toRawAmount(senderLeg);
  const b = toRawAmount(receiverLeg);
  const exactAmountBonus = a === b ? 500 : 0;
  const tinySolPenalty =
    isTinySolMovement(senderLeg) || isTinySolMovement(receiverLeg) ? -1000 : 0;
  const larger = a > b ? a : b;
  const diff = a > b ? a - b : b - a;
  const closeness = larger === 0n ? 0 : 1 - Number((diff * 1_000_000n) / larger) / 1_000_000;
  return exactAmountBonus + tinySolPenalty + closeness;
}

function findBestPair(
  legs: TxLeg[],
  senderRoles: Array<TxLeg["role"]>,
  receiverRoles: Array<TxLeg["role"]>,
  accept: (pair: TransferPair) => boolean,
  score: (senderLeg: TxLeg, receiverLeg: TxLeg) => number,
): TransferPair | null {
  const senderLegs = legs.filter(
    (leg) =>
      isExternalAccount(leg.accountId) &&
      leg.side === "debit" &&
      senderRoles.includes(leg.role),
  );

  if (senderLegs.length === 0) return null;

  let bestPair: TransferPair | null = null;
  let bestScore = -Infinity;

  for (const senderLeg of senderLegs) {
    const candidates = legs.filter(
      (leg) =>
        isExternalAccount(leg.accountId) &&
        leg.side === "credit" &&
        receiverRoles.includes(leg.role) &&
        leg.amount.token.mint === senderLeg.amount.token.mint &&
        leg.accountId !== senderLeg.accountId,
    );

    if (candidates.length === 0) continue;

    for (const receiverLeg of candidates) {
      if (!accept({ senderLeg, receiverLeg })) continue;
      const pairScore = score(senderLeg, receiverLeg);
      if (pairScore > bestScore) {
        bestScore = pairScore;
        bestPair = { senderLeg, receiverLeg };
      }
    }
  }

  return bestPair;
}

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

export function findBestExternalTransferPair(
  legs: TxLeg[],
  senderRoles: Array<TxLeg["role"]> = ["sent"],
  receiverRoles: Array<TxLeg["role"]> = ["received"],
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
      const score = scoreTransferPair(senderLeg, receiverLeg);
      if (score > bestScore) {
        bestScore = score;
        bestPair = { senderLeg, receiverLeg };
      }
    }
  }

  return bestPair;
}

import type { ClassifiedTransaction } from "tx-indexer";

export type TransactionDirection = "incoming" | "outgoing" | "self" | "neutral";

export interface DirectionInfo {
  direction: TransactionDirection;
  prefix: string;
  colorClass: string;
  label: string;
}

export function getTransactionDirection(
  transaction: ClassifiedTransaction,
  walletAddress: string,
): DirectionInfo {
  const { classification } = transaction;
  const sender = classification.sender?.toLowerCase();
  const receiver = classification.receiver?.toLowerCase();
  const wallet = walletAddress.toLowerCase();

  const isSender = sender === wallet;
  const isReceiver = receiver === wallet;

  if (isSender && isReceiver) {
    return {
      direction: "self",
      prefix: "",
      colorClass: "text-neutral-600/90",
      label: getTransactionLabel(classification.primaryType, "self"),
    };
  }

  if (isSender) {
    return {
      direction: "outgoing",
      prefix: "-",
      colorClass: "text-red-600/75",
      label: getTransactionLabel(classification.primaryType, "outgoing"),
    };
  }

  if (isReceiver) {
    return {
      direction: "incoming",
      prefix: "+",
      colorClass: "text-green-600/75",
      label: getTransactionLabel(classification.primaryType, "incoming"),
    };
  }

  return {
    direction: "neutral",
    prefix: "",
    colorClass: "text-neutral-600",
    label:
      classification.primaryType === "swap"
        ? "trade"
        : classification.primaryType.replace("_", " "),
  };
}

function getTransactionLabel(
  type: string,
  direction: TransactionDirection,
): string {
  if (type === "swap") {
    return "trade";
  }

  // Privacy Cash specific labels (user-friendly, from connected wallet's perspective)
  // Short labels that work on mobile, with clear meaning
  if (type === "privacy_deposit" || type === "privacy_withdraw") {
    if (direction === "outgoing") {
      // I deposited to my private balance
      return "deposited to private";
    }
    if (direction === "incoming") {
      // Someone sent me money via private transfer
      return "received private";
    }
    // Neutral case
    return "private transfer";
  }

  const formattedType = type.replace("_", " ");

  switch (direction) {
    case "incoming":
      return `received ${formattedType}`;
    case "outgoing":
      return `sent ${formattedType}`;
    case "self":
      return `self ${formattedType}`;
    default:
      return formattedType;
  }
}

export interface TokenAmount {
  token: { symbol: string; logoURI?: string };
  amountUi: number;
}

export function formatAmountWithDirection(
  amount: TokenAmount | null | undefined,
  direction: DirectionInfo,
): string {
  if (!amount) return "—";
  const formatted = `${amount.amountUi.toLocaleString()} ${amount.token.symbol}`;
  return direction.prefix ? `${direction.prefix}${formatted}` : formatted;
}

export function formatSwapDetails(
  primaryAmount: TokenAmount | null | undefined,
  secondaryAmount: TokenAmount | null | undefined,
): string | null {
  if (!primaryAmount || !secondaryAmount) return null;
  return `${primaryAmount.amountUi.toLocaleString()} ${primaryAmount.token.symbol} → ${secondaryAmount.amountUi.toLocaleString()} ${secondaryAmount.token.symbol}`;
}

export function getTokenFromAmount(
  amount: TokenAmount | null | undefined,
): { symbol: string; logoURI?: string } | null {
  if (!amount) return null;
  return amount.token;
}

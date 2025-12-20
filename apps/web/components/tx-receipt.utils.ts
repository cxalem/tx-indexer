import type { ClassifiedTransaction } from "tx-indexer";

const NFT_TRANSACTION_TYPES = ["nft_mint", "nft_purchase", "nft_sale"] as const;
const STABLECOINS = ["USDC", "USDT", "USDH", "PAI", "UXD", "EURC", "USDG"];

export type TransactionDisplayType = "nft" | "swap" | "transfer" | "regular";

export interface DisplayData {
  type: TransactionDisplayType;
  title: string;
  primaryAmount: {
    value: number;
    symbol: string;
    decimals?: number;
    formatted: string;
  } | null;
  secondaryAmount: {
    value: number;
    symbol: string;
    decimals?: number;
    formatted: string;
  } | null;
  usdValue: number | null;
  sender: string | null;
  receiver: string | null;
  nft?: { name?: string; mint?: string };
  isFreeNft: boolean;
  showExchangeRate: boolean;
}

export const isStablecoin = (symbol: string) =>
  STABLECOINS.includes(symbol.toUpperCase());

export const isSolToken = (symbol: string) => {
  const normalized = symbol.toUpperCase();
  return normalized === "SOL" || normalized === "WSOL";
};

export const formatAmount = (
  amount: number,
  symbol: string,
  decimals?: number
) => {
  if (decimals === 0) return String(Math.round(amount));
  return isStablecoin(symbol) ? amount.toFixed(2) : amount.toFixed(4);
};

const formatTitle = (type: string) =>
  type
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export function getDisplayData(
  classification: ClassifiedTransaction["classification"],
  metadata: Record<string, unknown> | undefined,
  solPrice: number | null | undefined
): DisplayData {
  const primaryType = classification.primaryType;
  const isNft = NFT_TRANSACTION_TYPES.includes(
    primaryType as (typeof NFT_TRANSACTION_TYPES)[number]
  );
  const isSwap = primaryType === "swap";
  const isTransfer = primaryType === "transfer";

  const primary = classification.primaryAmount;
  const secondary = classification.secondaryAmount;

  const primaryFormatted = primary
    ? {
        value: primary.amountUi,
        symbol: primary.token.symbol,
        decimals: primary.token.decimals,
        formatted: formatAmount(
          primary.amountUi,
          primary.token.symbol,
          primary.token.decimals
        ),
      }
    : null;

  const secondaryFormatted = secondary
    ? {
        value: secondary.amountUi,
        symbol: secondary.token.symbol,
        decimals: secondary.token.decimals,
        formatted: formatAmount(
          secondary.amountUi,
          secondary.token.symbol,
          secondary.token.decimals
        ),
      }
    : null;

  const calculateUsd = (): number | null => {
    if (!solPrice) return null;
    if (isNft && secondary) return secondary.amountUi * solPrice;
    if (primary && isSolToken(primary.token.symbol))
      return primary.amountUi * solPrice;
    if (primary && isStablecoin(primary.token.symbol)) return primary.amountUi;
    if (secondary && isSolToken(secondary.token.symbol))
      return secondary.amountUi * solPrice;
    return null;
  };

  const usdValue = calculateUsd();
  const showExchangeRate =
    solPrice !== null &&
    ((primary && isSolToken(primary.token.symbol)) ||
      (secondary && isSolToken(secondary.token.symbol)));

  let type: TransactionDisplayType = "regular";
  if (isNft) type = "nft";
  else if (isSwap) type = "swap";
  else if (isTransfer) type = "transfer";

  return {
    type,
    title: formatTitle(primaryType),
    primaryAmount: primaryFormatted,
    secondaryAmount: secondaryFormatted,
    usdValue,
    sender: classification.sender || null,
    receiver: classification.receiver || null,
    nft: isNft
      ? {
          name: metadata?.nft_name as string | undefined,
          mint: metadata?.nft_mint as string | undefined,
        }
      : undefined,
    isFreeNft: isNft && !secondary,
    showExchangeRate: !!showExchangeRate,
  };
}

"use client";

import type { ClassifiedTransaction } from "tx-indexer";
import { Circle, ImageIcon } from "lucide-react";
import localFont from "next/font/local";
import { CopyButton } from "@/components/copy-button";
import { formatDateOnly, formatTime, formatAddress } from "@/lib/utils";
import Image from "next/image";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

interface TransactionSummaryProps {
  transaction: ClassifiedTransaction;
}

const NFT_TRANSACTION_TYPES = ["nft_mint", "nft_purchase", "nft_sale"] as const;

function formatAmount(amountUi: number, decimals: number): string {
  if (decimals === 0) {
    return String(amountUi);
  }
  return amountUi.toLocaleString();
}

function NftPlaceholder() {
  return (
    <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
      <ImageIcon className="w-8 h-8 text-neutral-400" />
    </div>
  );
}

function StatusTag({ err }: { err: any }) {
  const isSuccess = err === null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        isSuccess ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      }`}
    >
      <Circle
        className={`h-2 w-2 ${isSuccess ? "fill-green-500" : "fill-red-500"}`}
        strokeWidth={0}
      />
      {isSuccess ? "Success" : "Failed"}
    </span>
  );
}

function getTransactionDescription(transaction: ClassifiedTransaction) {
  const { classification } = transaction;
  const type = classification.primaryType.replace("_", " ");
  const primary = classification.primaryAmount;
  const secondary = classification.secondaryAmount;

  if (!primary) {
    return <span className="text-neutral-500">{type} transaction</span>;
  }

  const primaryAmount = `${formatAmount(primary.amountUi, primary.token.decimals)} ${primary.token.symbol}`;

  if (classification.primaryType === "swap" && secondary) {
    const secondaryAmount = `${formatAmount(secondary.amountUi, secondary.token.decimals)} ${secondary.token.symbol}`;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-neutral-900">{primaryAmount}</span>
        <span className="text-neutral-400">→</span>
        <span className="font-semibold text-neutral-900">
          {secondaryAmount}
        </span>
      </div>
    );
  }

  if (classification.sender && classification.receiver) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm text-neutral-600">
          {formatAddress(classification.sender)}
        </span>
        <span className="text-neutral-400">→</span>
        <span className="font-semibold text-neutral-900">{primaryAmount}</span>
        <span className="text-neutral-400">→</span>
        <span className="font-mono text-sm text-neutral-600">
          {formatAddress(classification.receiver)}
        </span>
      </div>
    );
  }

  if (classification.receiver) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-neutral-900">{primaryAmount}</span>
        <span className="text-neutral-400">→</span>
        <span className="font-mono text-sm text-neutral-600">
          {formatAddress(classification.receiver)}
        </span>
      </div>
    );
  }

  if (classification.sender) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm text-neutral-600">
          {formatAddress(classification.sender)}
        </span>
        <span className="text-neutral-400">→</span>
        <span className="font-semibold text-neutral-900">{primaryAmount}</span>
      </div>
    );
  }

  return (
    <span className="font-semibold text-neutral-900">{primaryAmount}</span>
  );
}

function getHumanReadableSummary(transaction: ClassifiedTransaction): string {
  const { classification } = transaction;
  const type = classification.primaryType;
  const primary = classification.primaryAmount;
  const secondary = classification.secondaryAmount;
  const metadata = classification.metadata as
    | Record<string, unknown>
    | undefined;
  const nftName = metadata?.nft_name as string | undefined;
  const sender = classification.sender
    ? formatAddress(classification.sender)
    : null;
  const receiver = classification.receiver
    ? formatAddress(classification.receiver)
    : null;

  if (!primary) {
    return `${type.replace("_", " ")} transaction`;
  }

  const amount = `${formatAmount(primary.amountUi, primary.token.decimals)} ${primary.token.symbol}`;

  switch (type) {
    case "swap":
      if (secondary) {
        const secondaryAmount = `${formatAmount(secondary.amountUi, secondary.token.decimals)} ${secondary.token.symbol}`;
        return `Swapped ${amount} for ${secondaryAmount}.`;
      }
      return `Swap transaction for ${amount}.`;

    case "transfer":
      if (sender && receiver) {
        return `${sender} transferred ${amount} to ${receiver}.`;
      }
      if (receiver) {
        return `Transferred ${amount} to ${receiver}.`;
      }
      if (sender) {
        return `${sender} sent ${amount}.`;
      }
      return `Transfer of ${amount}.`;

    case "stake_deposit":
      return `Staked ${amount}.`;

    case "stake_withdraw":
      return `Unstaked ${amount}.`;

    case "airdrop":
      return `Received ${amount} airdrop.`;

    case "nft_mint": {
      const price = secondary
        ? `${formatAmount(secondary.amountUi, secondary.token.decimals)} ${secondary.token.symbol}`
        : null;
      if (nftName && price) {
        return `Minted ${nftName} for ${price}.`;
      }
      if (nftName) {
        return `Minted ${nftName}.`;
      }
      if (price) {
        return `Minted NFT for ${price}.`;
      }
      return `Minted NFT.`;
    }

    case "nft_purchase": {
      const price = secondary
        ? `${formatAmount(secondary.amountUi, secondary.token.decimals)} ${secondary.token.symbol}`
        : amount;
      if (nftName) {
        return `Purchased ${nftName} for ${price}.`;
      }
      return `Purchased NFT for ${price}.`;
    }

    case "nft_sale": {
      const price = secondary
        ? `${formatAmount(secondary.amountUi, secondary.token.decimals)} ${secondary.token.symbol}`
        : amount;
      if (nftName) {
        return `Sold ${nftName} for ${price}.`;
      }
      return `Sold NFT for ${price}.`;
    }

    case "bridge_in":
      return `Bridged in ${amount}.`;

    case "bridge_out":
      return `Bridged out ${amount}.`;

    case "token_deposit":
      return `Deposited ${amount}.`;

    case "token_withdraw":
      return `Withdrew ${amount}.`;

    case "reward":
      return `Received ${amount} as reward.`;

    case "fee_only":
      return `Paid ${amount} in fees.`;

    default:
      return `${type.replace("_", " ")} of ${amount}.`;
  }
}

export function TransactionSummary({ transaction }: TransactionSummaryProps) {
  const { tx, classification } = transaction;
  const metadata = classification.metadata as
    | Record<string, unknown>
    | undefined;
  const isNftTransaction = NFT_TRANSACTION_TYPES.includes(
    classification.primaryType as (typeof NFT_TRANSACTION_TYPES)[number]
  );

  const nftName = metadata?.nft_name as string | undefined;
  const nftImage = (metadata?.nft_cdn_image || metadata?.nft_image) as
    | string
    | undefined;
  const mintPrice = classification.secondaryAmount;

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <div>
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h1
            className={`${bitcountFont.className} lowercase text-3xl text-neutral-600`}
          >
            <span className="text-vibrant-red">{"//"}</span>{" "}
            {classification.primaryType.replace("_", " ")}
          </h1>
          <StatusTag err={tx.err} />
        </div>

        {isNftTransaction ? (
          <div className="flex flex-col items-center p-6">
            <div className="relative w-32 h-32 mb-4 rounded-lg overflow-hidden border-2 border-dashed border-neutral-300">
              {nftImage ? (
                <Image
                  src={nftImage}
                  alt={nftName || "NFT"}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <NftPlaceholder />
              )}
            </div>

            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              {nftName || "NFT"}
            </h2>

            <p className="text-sm text-neutral-500">
              {getHumanReadableSummary(transaction)}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center p-6">
            <div className="text-lg mb-2">
              {getTransactionDescription(transaction)}
            </div>

            <p className="text-sm text-neutral-500">
              {getHumanReadableSummary(transaction)}
            </p>
          </div>
        )}

        <div className="flex justify-between border-t border-neutral-100 px-6 py-4 w-full text-sm">
          <div>
            <div className="text-neutral-500 mb-1">Date</div>
            <div className="text-neutral-700 font-medium">
              {formatDateOnly(tx.blockTime)}
            </div>
          </div>
          <div>
            <div className="text-neutral-500 mb-1">Time</div>
            <div className="text-neutral-700 font-medium">
              {formatTime(tx.blockTime)}
            </div>
          </div>
          {isNftTransaction && mintPrice && (
            <div>
              <div className="text-neutral-500 mb-1">Price</div>
              <div className="text-neutral-700 font-medium">
                {formatAmount(mintPrice.amountUi, mintPrice.token.decimals)}{" "}
                {mintPrice.token.symbol}
              </div>
            </div>
          )}
          {tx.protocol && (
            <div>
              <div className="text-neutral-500 mb-1">Protocol</div>
              <div className="text-neutral-700 font-medium">
                {tx.protocol.name}
              </div>
            </div>
          )}
          {classification.counterparty && (
            <div>
              <div className="text-neutral-500 mb-1">
                {classification.counterparty.type === "protocol"
                  ? "Protocol"
                  : "Counterparty"}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-neutral-700">
                  {classification.counterparty.name ||
                    formatAddress(classification.counterparty.address)}
                </span>
                <CopyButton
                  text={classification.counterparty.address}
                  iconClassName="h-3 w-3"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

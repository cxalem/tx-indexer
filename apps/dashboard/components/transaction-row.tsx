"use client";

import type { ClassifiedTransaction } from "tx-indexer";
import { useState, useEffect } from "react";
import {
  formatRelativeTime,
  formatDateOnly,
  formatTime,
  truncate,
  cn,
} from "@/lib/utils";
import {
  getTransactionDirection,
  formatAmountWithDirection,
} from "@/lib/transaction-utils";
import {
  getTransactionIcon,
  getTransactionIconBgClass,
} from "@/lib/transaction-icons";
import { TokenIcon } from "@/components/token-icon";
import { CopyButton } from "@/components/copy-button";
import { LabeledAddress } from "@/components/labeled-address";
import { ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import Image from "next/image";

interface TransactionRowHeaderProps {
  transaction: ClassifiedTransaction;
  direction: ReturnType<typeof getTransactionDirection>;
  isExpanded: boolean;
  onToggle: () => void;
}

function TransactionRowHeader({
  transaction,
  direction,
  isExpanded,
  onToggle,
}: TransactionRowHeaderProps) {
  const { tx, classification } = transaction;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full p-4 hover:bg-neutral-50 transition-colors text-left cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-lg",
              getTransactionIconBgClass(direction.direction),
            )}
          >
            {getTransactionIcon(
              classification.primaryType,
              direction.direction,
            )}
          </div>
          <div>
            <p className="font-medium text-neutral-700 capitalize">
              {direction.label}
            </p>
            <div className="flex items-center gap-1">
              <span className="text-sm text-neutral-400 font-mono">
                {truncate(tx.signature)}
              </span>
              <CopyButton value={tx.signature} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full max-w-40">
          <div className="text-right flex flex-col w-full">
            <div className="flex justify-end gap-2">
              <p className={cn("font-mono", direction.colorClass)}>
                {formatAmountWithDirection(
                  classification.primaryAmount,
                  direction,
                )}
              </p>
              <div className="w-full max-w-6">
                {classification.primaryAmount?.token && (
                  <TokenIcon
                    symbol={classification.primaryAmount.token.symbol}
                    logoURI={classification.primaryAmount.token.logoURI}
                    size="md"
                  />
                )}
              </div>
            </div>
            <p className="text-sm text-neutral-400">
              {formatRelativeTime(tx.blockTime)}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-neutral-400 transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </div>
      </div>
    </button>
  );
}

interface TransactionRowDetailsProps {
  transaction: ClassifiedTransaction;
  walletAddress: string;
  isExpanded: boolean;
  labels?: Map<string, string>;
}

function TransactionRowDetails({
  transaction,
  walletAddress,
  isExpanded,
  labels,
}: TransactionRowDetailsProps) {
  const { tx, classification } = transaction;
  const isSuccess = tx.err === null;
  const isSwap = classification.primaryType === "swap";
  const isNft = ["nft_purchase", "nft_sale", "nft_mint"].includes(
    classification.primaryType,
  );
  const metadata = classification.metadata;
  const nftName =
    metadata && typeof metadata.nft_name === "string"
      ? metadata.nft_name
      : undefined;
  const nftImage =
    metadata && typeof metadata.nft_image === "string"
      ? metadata.nft_image
      : undefined;
  const fee = tx.fee ? tx.fee / 1e9 : 0;

  return (
    <div
      className={cn(
        "grid transition-all duration-200 ease-out",
        isExpanded
          ? "grid-rows-[1fr] opacity-100"
          : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="overflow-hidden">
        <div className="px-4 pb-4 pt-0">
          <div className="bg-neutral-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded",
                  isSuccess
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700",
                )}
              >
                {isSuccess ? "success" : "failed"}
              </span>
            </div>

            {isSwap &&
              classification.primaryAmount &&
              classification.secondaryAmount && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">trade details</p>
                  <div className="flex items-center gap-2 bg-white border rounded-lg w-fit px-3 py-2">
                    <TokenIcon
                      symbol={classification.primaryAmount.token.symbol}
                      logoURI={classification.primaryAmount.token.logoURI}
                      size="md"
                    />
                    <span className="font-mono text-neutral-600 text-lg">
                      {classification.primaryAmount.amountUi.toLocaleString()}{" "}
                      {classification.primaryAmount.token.symbol}
                    </span>
                    <ArrowRight className="h-4 w-4 text-neutral-400 mx-1" />
                    <TokenIcon
                      symbol={classification.secondaryAmount.token.symbol}
                      logoURI={classification.secondaryAmount.token.logoURI}
                      size="md"
                    />
                    <span className="font-mono text-neutral-600 text-lg">
                      {classification.secondaryAmount.amountUi.toLocaleString()}{" "}
                      {classification.secondaryAmount.token.symbol}
                    </span>
                  </div>
                </div>
              )}

            {isNft && nftName && (
              <div>
                <p className="text-xs text-neutral-500 mb-1">nft</p>
                <div className="flex items-center gap-3">
                  {nftImage && (
                    <Image
                      src={nftImage}
                      alt={nftName}
                      width={48}
                      height={48}
                      className="rounded-lg object-cover"
                      unoptimized
                    />
                  )}
                  <p className="text-sm font-medium">{nftName}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {classification.sender && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">from</p>
                  <LabeledAddress
                    address={classification.sender}
                    label={labels?.get(classification.sender)}
                  />
                </div>
              )}

              {classification.receiver && (
                <div>
                  <p className="text-xs text-neutral-500 mb-1">to</p>
                  <LabeledAddress
                    address={classification.receiver}
                    label={labels?.get(classification.receiver)}
                  />
                </div>
              )}
            </div>

            {tx.memo && (
              <div>
                <p className="text-xs text-neutral-500 mb-1">memo</p>
                <p className="text-sm bg-white rounded p-2 border border-neutral-200">
                  {tx.memo}
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-neutral-200">
              <div>
                <p className="text-xs text-neutral-500 mb-1">date</p>
                <p className="text-sm">{formatDateOnly(tx.blockTime)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">time</p>
                <p className="text-sm">{formatTime(tx.blockTime)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">fee</p>
                <p className="text-sm font-mono">{fee.toFixed(6)} SOL</p>
              </div>
            </div>

            <div className="pt-2">
              <a
                href={`https://itx-indexer.com/indexer/${tx.signature}?add=${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-vibrant-red hover:underline cursor-pointer"
              >
                view full details
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TransactionRowProps {
  transaction: ClassifiedTransaction;
  walletAddress: string;
  isNew?: boolean;
  labels?: Map<string, string>;
}

export function TransactionRow({
  transaction,
  walletAddress,
  isNew = false,
  labels,
}: TransactionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNewAnimation, setShowNewAnimation] = useState(isNew);
  const direction = getTransactionDirection(transaction, walletAddress);

  // Sync animation state when isNew prop changes
  useEffect(() => {
    if (isNew) {
      setShowNewAnimation(true);
      // Clear the "new" highlight after animation completes
      const timer = setTimeout(() => setShowNewAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  // Get animation class based on transaction direction
  const getNewAnimationClass = () => {
    if (!showNewAnimation) return "";
    if (direction.direction === "incoming")
      return "animate-new-transaction-incoming";
    if (direction.direction === "outgoing")
      return "animate-new-transaction-outgoing";
    return "animate-new-transaction-neutral";
  };

  return (
    <div
      className={cn(
        "border-b border-neutral-100 last:border-b-0 transition-all duration-500",
        getNewAnimationClass(),
      )}
    >
      <TransactionRowHeader
        transaction={transaction}
        direction={direction}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />
      <TransactionRowDetails
        transaction={transaction}
        walletAddress={walletAddress}
        isExpanded={isExpanded}
        labels={labels}
      />
    </div>
  );
}

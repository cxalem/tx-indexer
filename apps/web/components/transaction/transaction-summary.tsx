"use client";

import type { ClassifiedTransaction } from "tx-indexer";
import { Check, X, ArrowRight } from "lucide-react";
import localFont from "next/font/local";
import { CopyButton } from "@/components/copy-button";
import { formatDateOnly, formatTime, formatAddress } from "@/lib/utils";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

interface TransactionSummaryProps {
  transaction: ClassifiedTransaction;
}

function getStatusDisplay(err: any) {
  if (err === null) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <Check className="h-5 w-5" />
        <span className="font-medium">Success</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-red-600">
      <X className="h-5 w-5" />
      <span className="font-medium">Failed</span>
    </div>
  );
}

function getTransactionDescription(transaction: ClassifiedTransaction) {
  const { classification } = transaction;
  const type = classification.primaryType.replace("_", " ");
  const primary = classification.primaryAmount;
  const secondary = classification.secondaryAmount;

  if (!primary) {
    return `${type} transaction`;
  }

  const primaryAmount = `${primary.amountUi.toLocaleString()} ${primary.token.symbol}`;

  if (classification.primaryType === "swap" && secondary) {
    const secondaryAmount = `${secondary.amountUi.toLocaleString()} ${secondary.token.symbol}`;
    return (
      <>
        <span className="font-semibold">{primaryAmount}</span> →{" "}
        <span className="font-semibold">{secondaryAmount}</span>
      </>
    );
  }

  if (classification.sender && classification.receiver) {
    return (
      <>
        <span className="font-mono text-sm">{formatAddress(classification.sender)}</span>
        {" → "}
        <span className="font-semibold">{primaryAmount}</span>
        {" → "}
        <span className="font-mono text-sm">{formatAddress(classification.receiver)}</span>
      </>
    );
  }

  if (classification.receiver) {
    return (
      <>
        <span className="font-semibold">{primaryAmount}</span>
        {" → "}
        <span className="font-mono text-sm">{formatAddress(classification.receiver)}</span>
      </>
    );
  }

  if (classification.sender) {
    return (
      <>
        <span className="font-mono text-sm">{formatAddress(classification.sender)}</span>
        {" → "}
        <span className="font-semibold">{primaryAmount}</span>
      </>
    );
  }

  return (
    <>
      <span className="font-semibold">{primaryAmount}</span> {type}
    </>
  );
}

export function TransactionSummary({ transaction }: TransactionSummaryProps) {
  const { tx, classification } = transaction;

  return (
    <div className="border border-neutral-200 rounded-lg bg-white p-6">
      <h1
        className={`${bitcountFont.className} lowercase text-2xl text-neutral-600 mb-6`}
      >
        <span className="text-vibrant-red">{"//"}</span> TRANSACTION
      </h1>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <ArrowRight className="h-6 w-6 text-neutral-600" />
          <div>
            <h2 className="text-2xl font-semibold capitalize text-neutral-900">
              {classification.primaryType.replace("_", " ")}
            </h2>
          </div>
        </div>
        {getStatusDisplay(tx.err)}
      </div>

      <div className="space-y-4">
        <div className="text-lg text-neutral-700">
          {getTransactionDescription(transaction)}
        </div>

        {tx.protocol && (
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span className="text-neutral-500">Via:</span>
            <span className="font-medium">{tx.protocol.name}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <span>
            {formatDateOnly(tx.blockTime)} · {formatTime(tx.blockTime)}
          </span>
        </div>

        {classification.counterparty && (
          <div className="pt-4 border-t border-neutral-100">
            <div className="text-xs text-neutral-500 mb-1">
              {classification.counterparty.type === "protocol"
                ? "Protocol"
                : "Counterparty"}
            </div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm text-neutral-700">
                {classification.counterparty.name ||
                  classification.counterparty.address.slice(0, 16) + "..."}
              </div>
              <CopyButton
                text={classification.counterparty.address}
                iconClassName="h-3.5 w-3.5"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

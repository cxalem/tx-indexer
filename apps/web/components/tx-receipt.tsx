"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { Transaction } from "@/lib/types";
import { formatAddress } from "@/lib/utils";
import { useState } from "react";
import {
  Copy,
  Check,
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

interface TransactionReceiptProps {
  transaction: Transaction;
}

export function TransactionReceipt({ transaction }: TransactionReceiptProps) {
  const { tx, classification } = transaction;
  const [copied, setCopied] = useState(false);

  const date = new Date(Number(tx.blockTime) * 1000);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const isSuccess = !tx.err;
  const totalAmount =
    classification.secondaryAmount?.amountUi ||
    classification.primaryAmount?.amountUi ||
    0;

  const isStablecoin = (symbol: string) => {
    const stablecoins = ["USDC", "USDT", "USDH", "PAI", "UXD", "EURC", "USDG"];
    return stablecoins.includes(symbol.toUpperCase());
  };

  const formatAmount = (amount: number, symbol: string) => {
    return isStablecoin(symbol) ? amount.toFixed(2) : amount.toFixed(4);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(tx.signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDirectionIcon = (direction: string, primaryType: string) => {
    if (primaryType === "transfer" && direction === "neutral") {
      return <ArrowRight className="w-7 h-7 text-blue-600" />;
    }

    switch (direction) {
      case "incoming":
        return <ArrowDown className="w-7 h-7 text-green-600" />;
      case "outgoing":
        return <ArrowUp className="w-7 h-7 text-orange-600" />;
      case "neutral":
        return <ArrowLeftRight className="w-7 h-7 text-blue-600" />;
      case "self":
        return <RefreshCw className="w-7 h-7 text-gray-600" />;
      default:
        return null;
    }
  };

  return (
    <Card className="border-neutral-800/30 bg-white w-full max-w-md">
      <CardContent className="space-y-6 p-6">
        <div className="flex items-start justify-between border-b border-gray-200 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">itx</h2>
            <p className="font-mono text-xs text-muted-foreground">RECEIPT</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isSuccess
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {isSuccess ? "Success" : "Failed"}
          </span>
        </div>

        <div className="space-y-4">
          <div className="text-center flex flex-col items-center justify-center py-4">
            <div className="flex items-center justify-center gap-3 mb-1">
              {getDirectionIcon(
                classification.direction,
                classification.primaryType
              )}
              <h3 className="text-3xl font-bold text-foreground">
                {classification.primaryType
                  .replace(/_/g, " ")
                  .split(" ")
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ")}
              </h3>
            </div>
            {classification.primaryType === "transfer" &&
            classification.direction === "neutral" &&
            classification.metadata?.sender ? (
              <div className="flex items-center justify-center gap-2 text-sm mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground opacity-70 font-mono">
                    {formatAddress(classification.metadata.sender as string)}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">
                  {formatAmount(
                    classification.primaryAmount?.amountUi || 0,
                    classification.primaryAmount?.token.symbol || ""
                  )}{" "}
                  {classification.primaryAmount?.token.symbol}
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground opacity-70 font-mono">
                    {formatAddress(classification.counterparty?.address || "")}
                  </span>
                </div>
              </div>
            ) : (
              classification.counterparty && (
                <p className="text-muted-foreground">
                  {classification.direction === "incoming"
                    ? "from"
                    : classification.direction === "outgoing"
                      ? "to"
                      : classification.direction === "self"
                        ? "to yourself"
                        : "with"}{" "}
                  {classification.direction !== "self" &&
                    (classification.counterparty.name ||
                      formatAddress(classification.counterparty.address))}
                </p>
              )
            )}
          </div>

          <div className="text-center border-y border-gray-200 py-4">
            {classification.secondaryAmount ? (
              <>
                <div className="text-4xl font-bold text-foreground">
                  $
                  {formatAmount(
                    totalAmount,
                    classification.secondaryAmount.token.symbol
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {formatAmount(
                    classification.primaryAmount?.amountUi || 0,
                    classification.primaryAmount?.token.symbol || ""
                  )}{" "}
                  {classification.primaryAmount?.token.symbol}
                  {" → "}
                  {formatAmount(
                    classification.secondaryAmount.amountUi,
                    classification.secondaryAmount.token.symbol
                  )}{" "}
                  {classification.secondaryAmount.token.symbol}
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl font-bold text-foreground">
                  {formatAmount(
                    classification.primaryAmount?.amountUi || 0,
                    classification.primaryAmount?.token.symbol || "SOL"
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {classification.primaryAmount?.token.symbol || "SOL"}
                  {" ≈ "}${totalAmount.toFixed(2)}
                </div>
              </>
            )}
          </div>

          {tx.memo && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-foreground">{tx.memo}</p>
            </div>
          )}

          {tx.protocol && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Via</span>
              <span className="font-medium text-foreground">
                {tx.protocol.name}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium text-foreground">
              {formattedDate} at {formattedTime}
            </span>
          </div>

          <div className="space-y-2 border-t border-gray-200 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Transaction Fee</span>
              <span className="font-mono">{"<"}$0.01</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="font-mono">
                ${(totalAmount + 0.01).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Transaction ID</span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <span>{formatAddress(tx.signature)}</span>
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              // TODO: Implement full transaction view
            }}
            className="w-full text-sm text-vibrant-red hover:underline"
          >
            View full transaction →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ClassifiedTransaction } from "tx-indexer";
import { formatAddress, formatDateOnly, formatTime } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import { ArrowRight } from "lucide-react";

interface TransactionReceiptProps {
  transaction: ClassifiedTransaction;
  showViewFullTransaction?: boolean;
  walletAddress?: string;
}

export function TransactionReceipt({ 
  transaction, 
  showViewFullTransaction = false,
  walletAddress,
}: TransactionReceiptProps) {
  const { tx, classification } = transaction;

  const formattedDate = formatDateOnly(tx.blockTime);
  const formattedTime = formatTime(tx.blockTime);

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

  return (
    <Card className="border-neutral-800/30 bg-white w-full max-w-md print:shadow-none" data-print-receipt>
      <CardContent className="space-y-6 p-6 print:space-y-3 print:p-4">
        <div className="flex items-start justify-between border-b border-gray-200 pb-4 print:pb-2">
          <div>
            <h2 className="text-2xl font-bold text-foreground print:text-xl">itx</h2>
            <p className="font-mono text-xs text-muted-foreground print:text-[10px]">RECEIPT</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium print:text-xs print:px-2 print:py-0.5 ${
              isSuccess
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {isSuccess ? "Success" : "Failed"}
          </span>
        </div>

        <div className="space-y-4 print:space-y-2">
          <div className="text-center flex flex-col items-center justify-center py-4 print:py-2">
            <h3 className="text-3xl font-bold text-foreground print:text-2xl mb-2">
              {classification.primaryType
                .replace(/_/g, " ")
                .split(" ")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}
            </h3>
            {(classification.sender || classification.receiver) && (
              <div className="flex items-center justify-center gap-2 text-sm print:text-xs">
                {classification.sender && (
                  <span className="text-muted-foreground opacity-70 font-mono">
                    {formatAddress(classification.sender)}
                  </span>
                )}
                {classification.sender && classification.receiver && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground print:w-3 print:h-3" />
                )}
                <span className="font-semibold text-foreground">
                  {formatAmount(
                    classification.primaryAmount?.amountUi || 0,
                    classification.primaryAmount?.token.symbol || ""
                  )}{" "}
                  {classification.primaryAmount?.token.symbol}
                </span>
                {classification.sender && classification.receiver && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground print:w-3 print:h-3" />
                )}
                {classification.receiver && (
                  <span className="text-muted-foreground opacity-70 font-mono">
                    {formatAddress(classification.receiver)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="text-center border-y border-gray-200 py-4 print:py-2">
            {classification.secondaryAmount ? (
              <>
                <div className="text-4xl font-bold text-foreground print:text-3xl">
                  $
                  {formatAmount(
                    totalAmount,
                    classification.secondaryAmount.token.symbol
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-2 print:text-xs print:mt-1">
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
                <div className="text-4xl font-bold text-foreground print:text-3xl">
                  {formatAmount(
                    classification.primaryAmount?.amountUi || 0,
                    classification.primaryAmount?.token.symbol || "SOL"
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1 print:text-xs print:mt-0.5">
                  {classification.primaryAmount?.token.symbol || "SOL"}
                  {" ≈ "}${totalAmount.toFixed(2)}
                </div>
              </>
            )}
          </div>

          {tx.memo && (
            <div className="bg-gray-50 rounded-lg p-3 print:p-2">
              <p className="text-xs text-muted-foreground mb-1 print:text-[10px] print:mb-0.5">Description</p>
              <p className="text-sm text-foreground print:text-xs">{tx.memo}</p>
            </div>
          )}

          {tx.protocol && (
            <div className="flex items-center justify-between text-sm print:text-xs">
              <span className="text-muted-foreground">Via</span>
              <span className="font-medium text-foreground">
                {tx.protocol.name}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm print:text-xs">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium text-foreground">
              {formattedDate} at {formattedTime}
            </span>
          </div>

          <div className="space-y-2 border-t border-gray-200 pt-4 print:space-y-1 print:pt-2">
            <div className="flex justify-between text-sm print:text-xs">
              <span className="text-muted-foreground">Transaction Fee</span>
              <span className="font-mono">{"<"}$0.01</span>
            </div>
            <div className="flex justify-between font-bold print:text-sm">
              <span>Total</span>
              <span className="font-mono">
                ${(totalAmount + 0.01).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 print:pt-2">
            <div className="flex items-center justify-between text-xs print:text-[10px]">
              <span className="text-muted-foreground">Transaction ID</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">
                  {formatAddress(tx.signature)}
                </span>
                <CopyButton
                  text={tx.signature}
                  iconClassName="w-3.5 h-3.5 print:w-3 print:h-3"
                  className="print:cursor-default"
                />
              </div>
            </div>
          </div>

          {showViewFullTransaction && (
            <a
              href={
                walletAddress
                  ? `/indexer/${tx.signature}?add=${walletAddress}`
                  : `/indexer/${tx.signature}`
              }
              className="block w-full text-sm text-vibrant-red hover:underline text-center"
            >
              View full transaction →
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

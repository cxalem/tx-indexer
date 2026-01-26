"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { ClassifiedTransaction } from "tx-indexer";
import { formatAddress, formatDateOnly, formatTime } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import { ArrowRight, Palette } from "lucide-react";
import { getDisplayData, formatUsd } from "./tx-receipt.utils";

interface TransactionReceiptProps {
  transaction: ClassifiedTransaction;
  showViewFullTransaction?: boolean;
  walletAddress?: string;
  solPrice?: number | null;
}

export function TransactionReceipt({
  transaction,
  showViewFullTransaction = false,
  walletAddress,
  solPrice,
}: TransactionReceiptProps) {
  const { tx, classification } = transaction;
  const metadata = classification.metadata as
    | Record<string, unknown>
    | undefined;

  const formattedDate = formatDateOnly(tx.blockTime);
  const formattedTime = formatTime(tx.blockTime);
  const isSuccess = !tx.err;

  const feeInLamports = tx.fee ?? 5000;
  const feeInSol = feeInLamports / 1e9;
  const feeInUsd = solPrice ? feeInSol * solPrice : null;

  const display = getDisplayData(classification, metadata, solPrice);

  return (
    <Card
      className="border-neutral-800/30 bg-white w-full max-w-md print:shadow-none"
      data-print-receipt
    >
      <CardContent className="space-y-6 p-6 print:space-y-3 print:p-4">
        <div className="flex items-start justify-between border-b border-gray-200 pb-4 print:pb-2">
          <div>
            <h2 className="text-2xl font-bold text-foreground print:text-xl">
              itx
            </h2>
            <p className="font-mono text-xs text-muted-foreground print:text-[10px]">
              RECEIPT
            </p>
          </div>
          <span
            className={`px-3 py-1 lowercase rounded-full text-sm font-medium print:text-xs print:px-2 print:py-0.5 ${
              isSuccess
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {isSuccess ? "Success" : "Failed"}
          </span>
        </div>

        <div className="space-y-4 print:space-y-2">
          {display.type === "nft" ? (
            <div className="text-center flex flex-col items-center justify-center py-4 print:py-2">
              <div className="w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center mb-3">
                <Palette className="w-8 h-8 text-neutral-600" />
              </div>
              <h3 className="text-2xl font-bold text-foreground print:text-xl mb-1">
                {display.title}
              </h3>
              {display.nft?.name && (
                <p className="text-lg font-semibold text-foreground">
                  {display.nft.name}
                </p>
              )}
              {display.nft?.mint && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatAddress(display.nft.mint)}
                  </span>
                  <CopyButton text={display.nft.mint} iconClassName="w-3 h-3" />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center flex flex-col items-center justify-center py-4 print:py-2">
              <h3 className="text-3xl font-bold text-foreground print:text-2xl mb-2">
                {display.title}
              </h3>
              {(display.sender || display.receiver) && (
                <div className="flex items-center justify-center gap-2 text-sm print:text-xs">
                  {display.sender && (
                    <span className="text-muted-foreground opacity-70 font-mono">
                      {formatAddress(display.sender)}
                    </span>
                  )}
                  {display.sender && display.receiver && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground print:w-3 print:h-3" />
                  )}
                  {display.primaryAmount && (
                    <span className="font-semibold text-foreground">
                      {display.primaryAmount.formatted}{" "}
                      {display.primaryAmount.symbol}
                    </span>
                  )}
                  {display.sender && display.receiver && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground print:w-3 print:h-3" />
                  )}
                  {display.receiver && (
                    <span className="text-muted-foreground opacity-70 font-mono">
                      {formatAddress(display.receiver)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="text-center border-y border-gray-200 py-4 print:py-2">
            {display.isFreeNft ? (
              <div className="text-2xl font-medium text-muted-foreground print:text-xl">
                Free Mint
              </div>
            ) : display.type === "nft" && display.secondaryAmount ? (
              <>
                <div className="text-4xl font-bold text-foreground print:text-3xl">
                  {display.usdValue !== null
                    ? `$${formatUsd(display.usdValue)}`
                    : `${display.secondaryAmount.formatted} ${display.secondaryAmount.symbol}`}
                </div>
                <div className="text-sm text-muted-foreground mt-1 print:text-xs print:mt-0.5">
                  {display.secondaryAmount.formatted}{" "}
                  {display.secondaryAmount.symbol}
                </div>
              </>
            ) : display.type === "swap" &&
              display.primaryAmount &&
              display.secondaryAmount ? (
              <>
                <div className="text-4xl font-bold text-foreground print:text-3xl">
                  {display.usdValue !== null
                    ? `$${formatUsd(display.usdValue)}`
                    : `${display.secondaryAmount.formatted} ${display.secondaryAmount.symbol}`}
                </div>
                <div className="text-sm text-muted-foreground mt-2 print:text-xs print:mt-1">
                  {display.primaryAmount.formatted}{" "}
                  {display.primaryAmount.symbol}
                  {" → "}
                  {display.secondaryAmount.formatted}{" "}
                  {display.secondaryAmount.symbol}
                </div>
              </>
            ) : display.primaryAmount ? (
              <>
                <div className="text-4xl font-bold text-foreground print:text-3xl">
                  {display.usdValue !== null
                    ? `$${formatUsd(display.usdValue)}`
                    : `${display.primaryAmount.formatted} ${display.primaryAmount.symbol}`}
                </div>
                <div className="text-sm text-muted-foreground mt-1 print:text-xs print:mt-0.5">
                  {display.primaryAmount.formatted}{" "}
                  {display.primaryAmount.symbol}
                </div>
              </>
            ) : null}
          </div>

          {tx.memo && (
            <div className="bg-gray-50 rounded-lg p-3 print:p-2">
              <p className="text-xs text-muted-foreground mb-1 print:text-[10px] print:mb-0.5">
                Description
              </p>
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
              <span className="font-mono">
                {feeInUsd !== null
                  ? feeInUsd < 0.01
                    ? "<$0.01"
                    : `$${feeInUsd.toFixed(4)}`
                  : `${feeInSol.toFixed(6)} SOL`}
              </span>
            </div>
            {display.usdValue !== null && (
              <div className="flex justify-between font-bold print:text-sm">
                <span>Total</span>
                <span className="font-mono">
                  ${formatUsd(display.usdValue + (feeInUsd || 0))}
                </span>
              </div>
            )}
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

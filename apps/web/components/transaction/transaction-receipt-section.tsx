"use client";

import type { ClassifiedTransaction } from "tx-indexer";
import { TransactionReceipt } from "@/components/tx-receipt";
import { Share2, Printer } from "lucide-react";
import localFont from "next/font/local";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

interface TransactionReceiptSectionProps {
  transaction: ClassifiedTransaction;
}

export function TransactionReceiptSection({
  transaction,
}: TransactionReceiptSectionProps) {
  return (
    <div className="border border-neutral-200 rounded-lg bg-white p-6 print:border-0 print:p-0">
      <div className="flex items-center justify-between mb-6" data-print-hide>
        <h2
          className={`${bitcountFont.className} lowercase text-2xl text-neutral-600`}
        >
          <span className="text-vibrant-red">{"//"}</span> RECEIPT
        </h2>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-3 py-2 text-sm border border-neutral-200 rounded hover:bg-neutral-50 transition-colors lowercase"
            onClick={() => {
              console.log("Share receipt");
            }}
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </button>
          <button
            className="flex items-center gap-2 px-3 py-2 text-sm border border-neutral-200 rounded hover:bg-neutral-50 transition-colors lowercase"
            onClick={() => {
              window.print();
            }}
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      <TransactionReceipt transaction={transaction} />
    </div>
  );
}

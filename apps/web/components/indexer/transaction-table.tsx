"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownRight,
  Gift,
  Sparkles,
  Circle,
  ArrowRight,
  Inbox,
} from "lucide-react";
import type { Transaction } from "@/lib/types";
import localFont from "next/font/local";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

interface TransactionTableProps {
  transactions: Transaction[];
  title: string;
  subtitle?: string;
}

function getIcon(type: string, direction: string) {
  const className = "h-4 w-4";

  switch (type) {
    case "swap":
      return <ArrowLeftRight className={className} />;
    case "transfer":
      return direction === "incoming" ? (
        <ArrowDownRight className={className} />
      ) : (
        <ArrowUpRight className={className} />
      );
    case "airdrop":
      return <Gift className={className} />;
    case "nft_mint":
      return <Sparkles className={className} />;
    case "nft_sale":
      return <ArrowUpRight className={className} />;
    case "nft_purchase":
      return <ArrowDownRight className={className} />;
    default:
      return <Circle className={className} />;
  }
}

function getIconBg(type: string) {
  switch (type) {
    case "swap":
      return "bg-neutral-100 text-neutral-600";
    case "transfer":
      return "bg-neutral-100 text-neutral-600";
    case "airdrop":
      return "bg-neutral-100 text-neutral-600";
    case "nft_mint":
      return "bg-neutral-100 text-neutral-600";
    case "nft_sale":
    case "nft_purchase":
      return "bg-neutral-100 text-neutral-600";
    default:
      return "bg-neutral-100 text-neutral-600";
  }
}

function formatAmountDisplay(
  amount: {
    token: { symbol: string; mint: string; name?: string; decimals: number };
    amountUi: number;
    amountRaw: string;
  } | null | undefined
) {
  if (!amount) return "—";

  const formattedValue = amount.amountUi.toLocaleString();
  const parts = formattedValue.split(/([.,])/);

  return (
    <>
      {parts.map((part, index) => {
        if (part === "." || part === ",") {
          return (
            <span key={index} className="text-vibrant-red">
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}{" "}
      <span className={`text-neutral-500`}>{amount.token.symbol}</span>
    </>
  );
}

function formatTime(blockTime: number | bigint | null) {
  if (!blockTime) return "—";
  const date = new Date(Number(blockTime) * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TransactionTable({
  transactions,
  title,
  subtitle,
}: TransactionTableProps) {
  const router = useRouter();

  if (transactions.length === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2
            className={`${bitcountFont.className} text-3xl lowercase text-neutral-600`}
          >
            <span className="text-vibrant-red">{"//"}</span> {title}
          </h2>
        </div>

        <div className="border border-neutral-200 rounded-lg bg-white">
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-100 mx-auto mb-4 flex items-center justify-center">
              <Inbox className="h-6 w-6 text-neutral-400" />
            </div>
            <p className="lowercase text-neutral-600 mb-1">
              no transactions yet
            </p>
            <p className="text-sm lowercase text-neutral-400">
              {subtitle || "Connect your wallet to view transactions"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2
          className={`${bitcountFont.className} text-3xl text-neutral-600`}
        >
          <span className="text-vibrant-red">{"//"}</span> {title}
        </h2>
      </div>

      <div className="hidden md:block border border-neutral-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500">
                Type
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500">
                Amount
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500">
                Protocol
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-neutral-500">
                Time
              </th>
              <th className="w-12"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-100">
            {transactions.map((tx) => (
              <tr
                key={tx.tx.signature}
                className="hover:bg-neutral-50 cursor-pointer transition-colors group"
                onClick={() => router.push(`/indexer/${tx.tx.signature}`)}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getIconBg(tx.classification.primaryType)}`}>
                      {getIcon(tx.classification.primaryType, tx.classification.direction)}
                    </div>
                    <div>
                      <p className="capitalize font-medium text-neutral-700">
                        {tx.classification.primaryType.replace("_", " ")}
                      </p>
                      <p className="text-xs capitalize text-neutral-400">
                        {tx.classification.direction}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4">
                  <div className="font-mono">
                    {tx.classification.secondaryAmount ? (
                      <>
                        <p className="text-neutral-700">
                          {formatAmountDisplay(tx.classification.primaryAmount)}
                        </p>
                        <p className="text-sm text-neutral-400">
                          → {formatAmountDisplay(tx.classification.secondaryAmount)}
                        </p>
                      </>
                    ) : (
                      <p className="text-neutral-700">
                        {formatAmountDisplay(tx.classification.primaryAmount)}
                      </p>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4">
                  <span className=" text-sm text-neutral-600">
                    {tx.tx.protocol?.name || "Unknown"}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <span className="text-sm text-neutral-500">{formatTime(tx.tx.blockTime)}</span>
                </td>

                <td className="px-6 py-4">
                  <ArrowRight className="h-4 w-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {transactions.map((tx) => (
          <div
            key={tx.tx.signature}
            className="border border-neutral-200 rounded-lg p-4 bg-white hover:border-vibrant-red transition-colors cursor-pointer"
            onClick={() => router.push(`/indexer/${tx.tx.signature}`)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getIconBg(tx.classification.primaryType)}`}>
                  {getIcon(tx.classification.primaryType, tx.classification.direction)}
                </div>
                <div>
                  <p className=" font-medium text-neutral-700">
                    {tx.classification.primaryType.replace("_", " ")}
                  </p>
                  <p className="text-xs  text-neutral-400">{tx.classification.direction}</p>
                </div>
              </div>
              <span className="text-xs text-neutral-400">{formatTime(tx.tx.blockTime)}</span>
            </div>

            <div className="font-mono mb-2">
              {tx.classification.secondaryAmount ? (
                <>
                  <p className="text-neutral-700">
                    {formatAmountDisplay(tx.classification.primaryAmount)}
                  </p>
                  <p className="text-sm text-neutral-400">
                    → {formatAmountDisplay(tx.classification.secondaryAmount)}
                  </p>
                </>
              ) : (
                <p className="text-neutral-700">
                  {formatAmountDisplay(tx.classification.primaryAmount)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TokenIcon } from "@/components/token-icon";

interface MockTransaction {
  id: number;
  type: "incoming" | "outgoing" | "swap" | "nft_mint";
  label: string;
  amount: string;
  token: string;
  tokenLogo: string;
  time: string;
  signature: string;
}

const USDC_LOGO =
  "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png";

const MOCK_TRANSACTIONS: MockTransaction[] = [
  {
    id: 1,
    type: "incoming",
    label: "Received",
    amount: "+500.00",
    token: "USDC",
    tokenLogo: USDC_LOGO,
    time: "2 min ago",
    signature: "4xK9...mN2p",
  },
  {
    id: 2,
    type: "outgoing",
    label: "Sent",
    amount: "-125.50",
    token: "USDC",
    tokenLogo: USDC_LOGO,
    time: "5 min ago",
    signature: "7hR3...vB8q",
  },
  {
    id: 3,
    type: "swap",
    label: "Swap",
    amount: "+210.00",
    token: "USDC",
    tokenLogo: USDC_LOGO,
    time: "12 min ago",
    signature: "2wE5...kL4x",
  },
  {
    id: 4,
    type: "nft_mint",
    label: "NFT Mint",
    amount: "-85.00",
    token: "USDC",
    tokenLogo: USDC_LOGO,
    time: "1 hour ago",
    signature: "9pQ2...jH7m",
  },
];

function getIcon(type: MockTransaction["type"]) {
  const className = "h-4 w-4";
  switch (type) {
    case "incoming":
      return <ArrowDownLeft className={className} />;
    case "outgoing":
      return <ArrowUpRight className={className} />;
    case "swap":
      return <ArrowLeftRight className={className} />;
    case "nft_mint":
      return <Sparkles className={className} />;
  }
}

function getIconBgClass(type: MockTransaction["type"]) {
  switch (type) {
    case "incoming":
      return "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400";
    case "outgoing":
      return "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400";
    case "swap":
    case "nft_mint":
      return "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400";
  }
}

function getAmountClass(type: MockTransaction["type"]) {
  switch (type) {
    case "incoming":
      return "text-green-600 dark:text-green-400";
    case "outgoing":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-neutral-900 dark:text-neutral-100";
  }
}

function TransactionCard({
  transaction,
  stackPosition,
  isVisible,
}: {
  transaction: MockTransaction;
  stackPosition: number; // 0 = top, 1 = second, etc.
  isVisible: boolean;
}) {
  const offset = stackPosition * 16;
  const scale = 1 - stackPosition * 0.02;

  return (
    <div
      className={cn(
        "absolute inset-x-0 transition-all duration-500 ease-out",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      style={{
        // When appearing: start from above (-30px) and slide down to final position
        top: isVisible ? `${offset}px` : "-30px",
        zIndex: 10 - stackPosition, // Top card has highest z-index
        transform: `scale(${scale})`,
      }}
    >
      {/* Card matching transaction-row styling */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between">
            {/* Left side: Icon + Label + Signature */}
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded-lg",
                  getIconBgClass(transaction.type),
                )}
              >
                {getIcon(transaction.type)}
              </div>
              <div>
                <p className="font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                  {transaction.label}
                </p>
                <span className="text-sm text-neutral-400 dark:text-neutral-500 font-mono">
                  {transaction.signature}
                </span>
              </div>
            </div>

            {/* Right side: Amount + Token Icon + Time */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <p
                    className={cn(
                      "font-mono font-medium",
                      getAmountClass(transaction.type),
                    )}
                  >
                    {transaction.amount} {transaction.token}
                  </p>
                  <TokenIcon
                    symbol={transaction.token}
                    logoURI={transaction.tokenLogo}
                    size="md"
                  />
                </div>
                <p className="text-sm text-neutral-400 dark:text-neutral-500">
                  {transaction.time}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnimatedTransactions() {
  const [visibleIndices, setVisibleIndices] = useState<number[]>([]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let currentIndex = 0;

    const addNext = () => {
      if (currentIndex < MOCK_TRANSACTIONS.length) {
        const indexToAdd = currentIndex;
        setVisibleIndices((prev) => [indexToAdd, ...prev]);
        currentIndex++;
        timeoutId = setTimeout(addNext, 800);
      } else {
        // All visible, wait then reset
        timeoutId = setTimeout(() => {
          setVisibleIndices([]);
          currentIndex = 0;
          timeoutId = setTimeout(addNext, 500);
        }, 3000);
      }
    };

    // Start after initial delay
    timeoutId = setTimeout(addNext, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="relative h-[180px] w-full max-w-2xl mx-auto">
      {MOCK_TRANSACTIONS.map((tx, index) => {
        const stackPosition = visibleIndices.indexOf(index);
        const isVisible = stackPosition !== -1;

        return (
          <TransactionCard
            key={tx.id}
            transaction={tx}
            stackPosition={isVisible ? stackPosition : 0}
            isVisible={isVisible}
          />
        );
      })}
    </div>
  );
}

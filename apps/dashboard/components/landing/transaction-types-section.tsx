"use client";

import { useEffect, useRef, useState } from "react";
import localFont from "next/font/local";
import {
  ArrowRightLeft,
  Send,
  Palette,
  Landmark,
  Globe,
  Gift,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

interface ClassificationType {
  icon: LucideIcon;
  label: string;
  description: string;
  example: string;
}

const CLASSIFICATION_TYPES: ClassificationType[] = [
  {
    icon: ArrowRightLeft,
    label: "swap",
    description: "Token exchanges on any DEX",
    example: "100 USDC → 2.1 SOL",
  },
  {
    icon: Send,
    label: "transfer",
    description: "Wallet-to-wallet transfers",
    example: "+500 USDC received",
  },
  {
    icon: Palette,
    label: "nft mint",
    description: "NFT minting transactions",
    example: "Mad Lads #4521",
  },
  {
    icon: Landmark,
    label: "stake",
    description: "Staking deposits & withdrawals",
    example: "100 SOL → mSOL",
  },
  {
    icon: Globe,
    label: "bridge",
    description: "Cross-chain transfers",
    example: "ETH → Solana",
  },
  {
    icon: Gift,
    label: "airdrop",
    description: "Token distributions",
    example: "+1,000 JUP claimed",
  },
];

function TypeCard({
  type,
  index,
  isVisible,
}: {
  type: ClassificationType;
  index: number;
  isVisible: boolean;
}) {
  return (
    <div
      className={cn(
        "border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 bg-white dark:bg-neutral-900 transition-all duration-500 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
      )}
      style={{
        transitionDelay: `${index * 100}ms`,
      }}
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0">
          <type.icon className="w-6 h-6 text-vibrant-red" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 lowercase">
            {type.label}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 lowercase">
            {type.description}
          </p>
          <div className="mt-3 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800 rounded-md inline-block">
            <span className="text-xs font-mono text-neutral-600 dark:text-neutral-300">
              {type.example}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransactionTypesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -50px 0px",
      },
    );

    const currentRef = sectionRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  return (
    <section className="max-w-5xl mx-auto px-4 py-16" ref={sectionRef}>
      <h2
        className={`${bitcountFont.className} text-3xl text-neutral-600 dark:text-neutral-400 text-center mb-4`}
      >
        <span className="text-vibrant-red">{"//"}</span> transaction types
      </h2>
      <p className="text-center text-neutral-500 dark:text-neutral-400 mb-12 lowercase">
        every transaction automatically categorized
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CLASSIFICATION_TYPES.map((type, index) => (
          <TypeCard
            key={type.label}
            type={type}
            index={index}
            isVisible={isVisible}
          />
        ))}
      </div>
    </section>
  );
}

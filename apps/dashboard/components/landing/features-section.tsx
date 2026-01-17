import localFont from "next/font/local";
import {
  Zap,
  Eye,
  Filter,
  Clock,
  Tag,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  size: "small" | "medium" | "large";
}

const FEATURES: Feature[] = [
  {
    icon: Zap,
    title: "automatic classification",
    description:
      "Transactions labeled as swaps, transfers, NFT mints, staking, bridges, airdrops - no manual tagging required.",
    size: "large",
  },
  {
    icon: Eye,
    title: "protocol detection",
    description:
      "Recognizes 10+ protocols: Jupiter, Raydium, Orca, Metaplex, Wormhole, Pump.fun, and more.",
    size: "medium",
  },
  {
    icon: Filter,
    title: "spam filtering",
    description:
      "Hides dust attacks and spam tokens automatically. See only what matters.",
    size: "small",
  },
  {
    icon: Clock,
    title: "daily summaries",
    description:
      "Transactions grouped by day with net totals for easy tracking.",
    size: "small",
  },
  {
    icon: Tag,
    title: "wallet labels",
    description:
      "Name your frequently-used addresses for easier tracking and recognition.",
    size: "medium",
  },
  {
    icon: Bell,
    title: "real-time updates",
    description:
      "Live polling with optional fast mode and sound notifications.",
    size: "medium",
  },
];

function CodeSnippetPreview() {
  return (
    <div className="mt-6 p-3 bg-neutral-100 dark:bg-neutral-950 rounded-lg font-mono text-xs overflow-hidden">
      <div className="text-neutral-400 dark:text-neutral-500">
        {"// classified output"}
      </div>
      <div className="mt-1">
        <span className="text-purple-600 dark:text-purple-400">signature</span>
        <span className="text-neutral-500 dark:text-neutral-400">: </span>
        <span className="text-green-600 dark:text-green-400">
          "2xWv...jP5m"
        </span>
      </div>
      <div>
        <span className="text-purple-600 dark:text-purple-400">type</span>
        <span className="text-neutral-500 dark:text-neutral-400">: </span>
        <span className="text-green-600 dark:text-green-400">"transfer"</span>
      </div>
      <div>
        <span className="text-purple-600 dark:text-purple-400">amount</span>
        <span className="text-neutral-500 dark:text-neutral-400">: </span>
        <span className="text-amber-600 dark:text-amber-400">500</span>
        <span className="text-neutral-400 dark:text-neutral-500"> USDC</span>
      </div>
      <div>
        <span className="text-purple-600 dark:text-purple-400">sender</span>
        <span className="text-neutral-500 dark:text-neutral-400">: </span>
        <span className="text-green-600 dark:text-green-400">
          "9xH4...mK2p"
        </span>
      </div>
      <div>
        <span className="text-purple-600 dark:text-purple-400">receiver</span>
        <span className="text-neutral-500 dark:text-neutral-400">: </span>
        <span className="text-green-600 dark:text-green-400">
          "4xK9...vN8q"
        </span>
      </div>
    </div>
  );
}

function FeatureCard({
  feature,
  className,
  showMiniTransaction = false,
}: {
  feature: Feature;
  className?: string;
  showMiniTransaction?: boolean;
}) {
  return (
    <div
      className={cn(
        "group border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 bg-white dark:bg-neutral-900 hover:border-vibrant-red/30 transition-all duration-300",
        feature.size === "large" && "p-8",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 group-hover:bg-vibrant-red/10 transition-colors duration-300",
          feature.size === "large" ? "p-4 mb-6" : "p-3 mb-4",
        )}
      >
        <feature.icon
          className={cn(
            "text-vibrant-red",
            feature.size === "large" ? "w-10 h-10" : "w-6 h-6",
          )}
        />
      </div>
      <h3
        className={cn(
          "font-semibold text-neutral-900 dark:text-neutral-100 mb-2 lowercase",
          feature.size === "large" ? "text-xl" : "text-base",
        )}
      >
        {feature.title}
      </h3>
      <p
        className={cn(
          "text-neutral-600 dark:text-neutral-400 lowercase",
          feature.size === "large" ? "text-base" : "text-sm",
        )}
      >
        {feature.description}
      </p>
      {showMiniTransaction && <CodeSnippetPreview />}
    </div>
  );
}

export function FeaturesSection() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <h2
        className={`${bitcountFont.className} text-3xl text-neutral-600 dark:text-neutral-400 text-center mb-12`}
      >
        <span className="text-vibrant-red">{"//"}</span> features
      </h2>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Row 1-2: Large (2x2) + Protocol + 2 small */}
        <div className="md:col-span-2 md:row-span-2">
          <FeatureCard
            feature={FEATURES[0]!}
            className="h-full"
            showMiniTransaction
          />
        </div>
        <div className="md:col-span-2">
          <FeatureCard feature={FEATURES[1]!} className="h-full" />
        </div>
        <div className="md:col-span-1">
          <FeatureCard feature={FEATURES[2]!} className="h-full" />
        </div>
        <div className="md:col-span-1">
          <FeatureCard feature={FEATURES[3]!} className="h-full" />
        </div>

        <div className="md:col-span-2">
          <FeatureCard feature={FEATURES[4]!} className="h-full" />
        </div>
        <div className="md:col-span-2">
          <FeatureCard feature={FEATURES[5]!} className="h-full" />
        </div>
      </div>
    </section>
  );
}

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

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: Zap,
    title: "automatic classification",
    description:
      "Transactions labeled as swaps, transfers, NFT mints, staking, bridges, airdrops - no manual tagging required.",
  },
  {
    icon: Eye,
    title: "protocol detection",
    description:
      "Recognizes 30+ protocols: Jupiter, Raydium, Orca, Metaplex, Wormhole, Pump.fun, and more.",
  },
  {
    icon: Filter,
    title: "spam filtering",
    description:
      "Hides dust attacks and spam tokens automatically. See only what matters.",
  },
  {
    icon: Clock,
    title: "daily summaries",
    description:
      "Transactions grouped by day with net totals for easy tracking.",
  },
  {
    icon: Tag,
    title: "wallet labels",
    description:
      "Name your frequently-used addresses for easier tracking and recognition.",
  },
  {
    icon: Bell,
    title: "real-time updates",
    description:
      "Live polling with optional fast mode and sound notifications.",
  },
];

export function FeaturesSection() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <h2
        className={`${bitcountFont.className} text-3xl text-neutral-600 dark:text-neutral-400 text-center mb-12`}
      >
        <span className="text-vibrant-red">{"//"}</span> features
      </h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 bg-white dark:bg-neutral-900"
          >
            <feature.icon className="w-8 h-8 text-vibrant-red mb-4" />
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2 lowercase">
              {feature.title}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 lowercase">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

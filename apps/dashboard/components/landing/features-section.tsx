import localFont from "next/font/local";
import {
  Send,
  ArrowRightLeft,
  Shield,
  Filter,
  Activity,
  Bell,
  Tag,
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
    icon: Send,
    title: "send and receive",
    description:
      "Transfer SOL and tokens instantly. Save contacts with labels for quick transfers to your favorite addresses.",
    size: "large",
  },
  {
    icon: ArrowRightLeft,
    title: "trade",
    description:
      "Swap tokens directly from your dashboard. Powered by Jupiter for the best rates across Solana DEXs.",
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
    icon: Shield,
    title: "privacy hub",
    description:
      "Shield your funds with zero-knowledge proofs. Send privately without revealing your wallet.",
    size: "small",
  },
  {
    icon: Activity,
    title: "activity feed",
    description:
      "See your full transaction history, classified and organized by day. Swaps, transfers, NFT mints - all labeled automatically.",
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

const MOCK_CONTACTS = [
  { label: "alice.sol", address: "7xK9...mN2p" },
  { label: "mom", address: "9pL5...wT6j" },
  { label: "savings", address: "4hR3...vQ8k" },
];

function ContactListPreview() {
  return (
    <div className="mt-6 space-y-2">
      {MOCK_CONTACTS.map((contact) => (
        <div
          key={contact.label}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
        >
          <Tag className="h-4 w-4 text-vibrant-red" />
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {contact.label}
          </span>
          <span className="text-neutral-400 text-xs font-mono">
            ({contact.address})
          </span>
        </div>
      ))}
    </div>
  );
}

function FeatureCard({
  feature,
  className,
  showContactList = false,
}: {
  feature: Feature;
  className?: string;
  showContactList?: boolean;
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
      {showContactList && <ContactListPreview />}
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
            showContactList
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

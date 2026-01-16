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

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

interface ClassificationType {
  icon: LucideIcon;
  label: string;
  description: string;
}

const CLASSIFICATION_TYPES: ClassificationType[] = [
  {
    icon: ArrowRightLeft,
    label: "swap",
    description: "Token exchanges on any DEX",
  },
  { icon: Send, label: "transfer", description: "Wallet-to-wallet transfers" },
  { icon: Palette, label: "nft mint", description: "NFT minting transactions" },
  {
    icon: Landmark,
    label: "stake",
    description: "Staking deposits & withdrawals",
  },
  { icon: Globe, label: "bridge", description: "Cross-chain transfers" },
  { icon: Gift, label: "airdrop", description: "Token distributions" },
];

export function TransactionTypesSection() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <h2
        className={`${bitcountFont.className} text-3xl text-neutral-600 dark:text-neutral-400 text-center mb-4`}
      >
        <span className="text-vibrant-red">{"//"}</span> transaction types
      </h2>
      <p className="text-center text-neutral-500 dark:text-neutral-400 mb-12 lowercase">
        every transaction automatically categorized
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {CLASSIFICATION_TYPES.map((type) => (
          <div
            key={type.label}
            className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 bg-white dark:bg-neutral-900 hover:border-vibrant-red/30 transition-colors text-center"
          >
            <type.icon className="w-8 h-8 text-vibrant-red mx-auto mb-3" />
            <p className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm lowercase">
              {type.label}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 lowercase">
              {type.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

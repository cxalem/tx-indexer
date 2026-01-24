import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  Sparkles,
  Circle,
  Shield,
  ShieldOff,
} from "lucide-react";

/**
 * Returns the appropriate icon component for a transaction based on type and direction
 */
export function getTransactionIcon(type: string, direction: string) {
  const className = "h-4 w-4";

  // Privacy Cash specific icons (take priority)
  if (type === "privacy_deposit") {
    return <Shield className={className} />;
  }
  if (type === "privacy_withdraw") {
    return <ShieldOff className={className} />;
  }

  if (direction === "incoming") {
    return <ArrowDownLeft className={className} />;
  }
  if (direction === "outgoing") {
    return <ArrowUpRight className={className} />;
  }

  switch (type) {
    case "swap":
      return <ArrowLeftRight className={className} />;
    case "transfer":
      return <ArrowRight className={className} />;
    case "airdrop":
      return <Gift className={className} />;
    case "nft_mint":
      return <Sparkles className={className} />;
    default:
      return <Circle className={className} />;
  }
}

/**
 * Returns the background/text color classes for a transaction icon based on direction
 */
export function getTransactionIconBgClass(
  direction: string,
  type?: string,
): string {
  // Privacy Cash transactions get purple styling
  if (type === "privacy_deposit" || type === "privacy_withdraw") {
    return "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400";
  }

  switch (direction) {
    case "incoming":
      return "bg-green-50 text-green-600";
    case "outgoing":
      return "bg-red-50 text-red-600";
    default:
      return "bg-neutral-100 text-neutral-600";
  }
}

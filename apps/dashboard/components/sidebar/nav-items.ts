import {
  Wallet,
  ArrowRightLeft,
  TrendingUp,
  Target,
  Settings,
  Coins,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  disabled?: boolean;
  comingSoon?: boolean;
  isAction?: boolean;
  actionId?: string;
}

export const mainNavItems: NavItem[] = [
  {
    label: "wallet",
    href: "/",
    icon: Wallet,
  },
  {
    label: "trade",
    icon: ArrowRightLeft,
    isAction: true,
    actionId: "trade",
  },
  {
    label: "earn",
    href: "/earn",
    icon: Coins,
    disabled: true,
    comingSoon: true,
  },
  {
    label: "stocks",
    href: "/stocks",
    icon: TrendingUp,
    disabled: true,
    comingSoon: true,
  },
  {
    label: "predictions",
    href: "/predictions",
    icon: Target,
    disabled: true,
    comingSoon: true,
  },
];

export const bottomNavItems: NavItem[] = [
  {
    label: "settings",
    href: "/settings",
    icon: Settings,
    disabled: true,
    comingSoon: true,
  },
];

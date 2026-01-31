import {
  Activity,
  ArrowRightLeft,
  Layers,
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
    label: "activity",
    href: "/",
    icon: Activity,
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
    label: "assets",
    href: "/assets",
    icon: Layers,
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
  },
];

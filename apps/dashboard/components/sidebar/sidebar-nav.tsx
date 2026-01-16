"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

interface SidebarNavProps {
  items: NavItem[];
  onAction?: (actionId: string) => void;
}

export function SidebarNav({ items, onAction }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = item.href ? pathname === item.href : false;
        const Icon = item.icon;
        const key = item.href || item.actionId || item.label;

        if (item.disabled) {
          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                "text-neutral-400 dark:text-neutral-500 cursor-not-allowed",
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="lowercase">{item.label}</span>
              {item.comingSoon && (
                <span className="ml-auto text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded lowercase">
                  soon
                </span>
              )}
            </div>
          );
        }

        if (item.isAction && item.actionId) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => onAction?.(item.actionId!)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100",
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="lowercase">{item.label}</span>
            </button>
          );
        }

        return (
          <Link
            key={key}
            href={item.href!}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              isActive
                ? "bg-vibrant-red/10 text-vibrant-red font-medium"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100",
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="lowercase">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

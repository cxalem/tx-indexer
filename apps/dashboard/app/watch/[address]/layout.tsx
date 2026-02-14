"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { Eye, Activity, Layers, ArrowLeft } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { WatchPortfolioCard } from "@/components/watch/watch-portfolio-card";
import { WatchFundingSourceCard } from "@/components/watch/watch-funding-source-card";
import { truncate, cn } from "@/lib/utils";
import { bitcountFont } from "@/lib/fonts";
import { useRecentWatches } from "@/hooks/use-recent-watches";
import { NoisyBackground } from "@/components/noisy-bg";
import { GridBackground } from "@/components/grid-bg";

interface WatchLayoutProps {
  children: React.ReactNode;
}

export default function WatchLayout({ children }: WatchLayoutProps) {
  const params = useParams();
  const pathname = usePathname();
  const address = params.address as string;
  const { addRecentWatch } = useRecentWatches();

  // Add to recent watches when viewing
  useEffect(() => {
    if (address) {
      addRecentWatch(address);
    }
  }, [address, addRecentWatch]);

  // Determine active tab
  const isAssetsTab = pathname.endsWith("/assets");
  const isActivityTab = !isAssetsTab; // Default to activity

  const tabs = [
    {
      label: "activity",
      href: `/watch/${address}`,
      icon: Activity,
      active: isActivityTab,
    },
    {
      label: "assets",
      href: `/watch/${address}/assets`,
      icon: Layers,
      active: isAssetsTab,
    },
  ];

  return (
    <>
      {/* Background patterns */}
      <NoisyBackground showDots />
      <GridBackground />

      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4">
            {/* Top row: back + title */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Link
                  href="/watch"
                  className="p-1.5 -ml-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  aria-label="Back to watch"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1
                  className={`${bitcountFont.className} text-xl text-neutral-900 dark:text-neutral-100`}
                >
                  <span className="text-vibrant-red">{"//"}</span> watch
                </h1>
              </div>

              {/* Wallet badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <Eye className="w-3.5 h-3.5 text-neutral-400" />
                <span className="font-mono text-xs text-neutral-600 dark:text-neutral-300">
                  {truncate(address)}
                </span>
                <CopyButton value={address} />
              </div>
            </div>

            {/* Tabs */}
            <nav className="flex gap-1 -mb-px" aria-label="Watch tabs">
              {tabs.map((tab) => (
                <Link
                  key={tab.label}
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer",
                    tab.active
                      ? "border-vibrant-red text-vibrant-red"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600",
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1">
          <div className="max-w-4xl mx-auto px-4 pt-8">
            {/* Portfolio card at layout level - persists across tab navigation */}
            <div className="space-y-3">
              <WatchPortfolioCard walletAddress={address} />
              <WatchFundingSourceCard walletAddress={address} />
            </div>
          </div>
          {children}
        </main>
      </div>
    </>
  );
}

"use client";

import { Settings, Shield, Bell, Tag, Palette } from "lucide-react";
import { PrivacyToggle } from "@/components/privacy";
import { usePrivacyFeature } from "@/hooks/use-privacy-feature";
import { bitcountFont } from "@/lib/fonts";

export default function SettingsPage() {
  const { isEnabled, toggle, isLoaded, isAnimating } = usePrivacyFeature();

  return (
    <div className="flex-1 p-6 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1
          className={`${bitcountFont.className} text-3xl text-neutral-900 dark:text-neutral-100 mb-2`}
        >
          <span className="text-vibrant-red">{"//"}</span> settings
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 lowercase">
          manage your dashboard preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Privacy Section */}
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="font-medium text-neutral-900 dark:text-neutral-100 lowercase">
                  privacy
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 lowercase">
                  shielded transactions with zero-knowledge proofs
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Privacy Cash enables shielded transactions using zero-knowledge
              proofs. Your funds are deposited into a private pool and can be
              withdrawn to any address without a traceable link.
            </p>
            {isLoaded ? (
              <PrivacyToggle
                enabled={isEnabled}
                onToggle={toggle}
                disabled={isAnimating}
              />
            ) : (
              <div className="h-[72px] rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
            )}
            {isEnabled && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                When enabled, you&apos;ll see a{" "}
                <span className="font-medium text-purple-700 dark:text-purple-300">
                  privacy
                </span>{" "}
                button in your sidebar to shield and unshield funds.
              </p>
            )}
          </div>
        </section>

        {/* Coming Soon Sections */}
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden opacity-50">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <Tag className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              </div>
              <div className="flex-1">
                <h2 className="font-medium text-neutral-900 dark:text-neutral-100 lowercase">
                  wallet labels
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 lowercase">
                  organize your contacts with custom labels
                </p>
              </div>
              <span className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-2 py-1 rounded-full lowercase">
                coming soon
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden opacity-50">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <Bell className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              </div>
              <div className="flex-1">
                <h2 className="font-medium text-neutral-900 dark:text-neutral-100 lowercase">
                  notifications
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 lowercase">
                  alerts for transactions and price movements
                </p>
              </div>
              <span className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-2 py-1 rounded-full lowercase">
                coming soon
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden opacity-50">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <Palette className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
              </div>
              <div className="flex-1">
                <h2 className="font-medium text-neutral-900 dark:text-neutral-100 lowercase">
                  display
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 lowercase">
                  customize your dashboard appearance
                </p>
              </div>
              <span className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-2 py-1 rounded-full lowercase">
                coming soon
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

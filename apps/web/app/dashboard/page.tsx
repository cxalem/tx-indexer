import localFont from "next/font/local";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

const bitcountFont = localFont({
  src: "../fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <h1
          className={`${bitcountFont.className} text-5xl text-neutral-900 mb-4`}
        >
          <span className="text-vibrant-red">{"//"}</span> dashboard
        </h1>
        <p className="text-xl text-neutral-600 mb-8 lowercase">
          your solana transaction command center
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full">
          <div className="w-2 h-2 bg-vibrant-red rounded-full animate-pulse" />
          <span className="text-sm text-neutral-600 lowercase">
            coming soon
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="border border-neutral-200 rounded-lg p-6 bg-white hover:border-vibrant-red/30 transition-colors">
          <h3 className="text-xl font-semibold text-neutral-900 mb-3">
            account statements
          </h3>
          <p className="text-neutral-600 lowercase leading-relaxed">
            generate comprehensive transaction reports with automatic
            categorization. export to CSV for accounting or tax purposes.
          </p>
        </div>

        <div className="border border-neutral-200 rounded-lg p-6 bg-white hover:border-vibrant-red/30 transition-colors">
          <h3 className="text-xl font-semibold text-neutral-900 mb-3">
            smart labeling
          </h3>
          <p className="text-neutral-600 lowercase leading-relaxed">
            label your wallets and frequently used addresses. transform cryptic
            addresses into recognizable names like &quot;trading account&quot;
            or &quot;savings wallet&quot;.
          </p>
        </div>

        <div className="border border-neutral-200 rounded-lg p-6 bg-white hover:border-vibrant-red/30 transition-colors">
          <h3 className="text-xl font-semibold text-neutral-900 mb-3">
            financial insights
          </h3>
          <p className="text-neutral-600 lowercase leading-relaxed">
            track your portfolio across all wallets. understand your transaction
            patterns, top protocols used, and spending trends.
          </p>
        </div>

        <div className="border border-neutral-200 rounded-lg p-6 bg-white hover:border-vibrant-red/30 transition-colors">
          <h3 className="text-xl font-semibold text-neutral-900 mb-3">
            custom classification
          </h3>
          <p className="text-neutral-600 lowercase leading-relaxed">
            create your own categories for better organization.
          </p>
        </div>
      </div>
    </div>
  );
}

import localFont from "next/font/local";
import { Search } from "lucide-react";
import { TransactionsSection } from "@/components/indexer/transactions-section";

const bitcountFont = localFont({
  src: "../fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export default async function IndexerPage() {
  return (
    <div className="w-full pb-20">
      <section className="max-w-4xl mx-auto text-center py-16 px-4">
        <h1
          className={`${bitcountFont.className} text-5xl text-neutral-600 mb-4`}
        >
          <span className="text-vibrant-red">{"//"}</span> indexer
        </h1>
        <p className="lowercase text-neutral-500 mb-8">
          explore solana transactions
        </p>

        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 h-5 w-5" />
          <input
            type="text"
            placeholder="search transaction or wallet..."
            className="w-full lowercase pl-12 pr-4 py-4 rounded-2xl border-2 border-neutral-200 
                   focus:border-vibrant-red focus:outline-none transition-colors
                   bg-white"
          />
        </div>
      </section>

      <TransactionsSection />
    </div>
  );
}

import localFont from "next/font/local";
import { ArrowRight, Github } from "lucide-react";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

const CODE_EXAMPLE = `import { createIndexer } from "tx-indexer";

const indexer = createIndexer({ 
  rpcUrl: "https://api.mainnet-beta.solana.com" 
});

// Get classified transactions
const txs = await indexer.getTransactions(walletAddress, {
  limit: 20,
  filterSpam: true
});

// Access classification
txs.forEach(tx => {
  console.log(tx.classification.primaryType); // "swap", "transfer", etc.
  console.log(tx.tx.protocol?.name);          // "Jupiter", "Raydium", etc.
});`;

export function DevelopersSection() {
  return (
    <section className="max-w-4xl mx-auto px-4 py-16">
      <h2
        className={`${bitcountFont.className} text-3xl text-neutral-600 dark:text-neutral-400 text-center mb-4`}
      >
        <span className="text-vibrant-red">{"//"}</span> for developers
      </h2>
      <p className="text-center text-neutral-500 dark:text-neutral-400 mb-8 lowercase">
        use the SDK directly in your applications
      </p>

      {/* Install Command */}
      <div className="max-w-xl mx-auto mb-8">
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 px-4 py-2">
            <span className="px-3 py-1 bg-vibrant-red text-white text-sm font-medium rounded">
              npm
            </span>
            <span className="px-3 py-1 text-neutral-500 dark:text-neutral-400 text-sm">
              pnpm
            </span>
            <span className="px-3 py-1 text-neutral-500 dark:text-neutral-400 text-sm">
              yarn
            </span>
            <span className="px-3 py-1 text-neutral-500 dark:text-neutral-400 text-sm">
              bun
            </span>
          </div>
          <div className="px-4 py-4">
            <code className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
              npm install tx-indexer
            </code>
          </div>
        </div>
      </div>

      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg p-6 bg-white dark:bg-neutral-900">
        <pre className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-neutral-800 dark:text-neutral-200">
            {CODE_EXAMPLE}
          </code>
        </pre>
      </div>

      <div className="flex justify-center gap-4 mt-8">
        <a
          href="https://itx-indexer.com/docs"
          className="inline-flex items-center gap-2 px-6 py-3 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-lg hover:border-vibrant-red/30 transition-colors lowercase"
        >
          read the docs
          <ArrowRight className="w-4 h-4" />
        </a>
        <a
          href="https://github.com/cxalem/tx-indexer"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded-lg hover:border-vibrant-red/30 transition-colors lowercase"
        >
          <Github className="w-4 h-4" />
          view on github
        </a>
      </div>
    </section>
  );
}

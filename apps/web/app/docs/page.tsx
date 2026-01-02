import localFont from "next/font/local";

const bitcountFont = localFont({
  src: "../fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <h1
          className={`${bitcountFont.className} text-5xl text-neutral-900 mb-4`}
        >
          <span className="text-vibrant-red">{"//"}</span> documentation
        </h1>
        <p className="text-xl text-neutral-600 mb-8 lowercase">
          learn how to use tx-indexer
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full">
          <div className="w-2 h-2 bg-vibrant-red rounded-full animate-pulse" />
          <span className="text-sm text-neutral-600 lowercase">
            under construction
          </span>
        </div>
      </div>

      <div className="space-y-12">
        <section className="border border-neutral-200 rounded-lg p-8 bg-white">
          <h2 className="text-2xl font-semibold text-neutral-900 mb-4 lowercase">
            installation
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-neutral-600 mb-2 lowercase">npm</p>
              <code className="block p-3 bg-neutral-50 rounded border border-neutral-200 font-mono text-sm">
                npm install tx-indexer
              </code>
            </div>
            <div>
              <p className="text-sm text-neutral-600 mb-2 lowercase">bun</p>
              <code className="block p-3 bg-neutral-50 rounded border border-neutral-200 font-mono text-sm">
                bun add tx-indexer
              </code>
            </div>
            <div>
              <p className="text-sm text-neutral-600 mb-2 lowercase">yarn</p>
              <code className="block p-3 bg-neutral-50 rounded border border-neutral-200 font-mono text-sm">
                yarn add tx-indexer
              </code>
            </div>
            <div>
              <p className="text-sm text-neutral-600 mb-2 lowercase">pnpm</p>
              <code className="block p-3 bg-neutral-50 rounded border border-neutral-200 font-mono text-sm">
                pnpm add tx-indexer
              </code>
            </div>
          </div>
        </section>

        <section className="border border-neutral-200 rounded-lg p-8 bg-white">
          <h2 className="text-2xl font-semibold text-neutral-900 mb-4 lowercase">
            quick start
          </h2>
          <pre className="p-4 bg-neutral-50 rounded border border-neutral-200 overflow-x-auto">
            <code className="text-sm">{`import { createIndexer } from "tx-indexer";

const indexer = createIndexer({ 
  rpcUrl: "https://api.mainnet-beta.solana.com" 
});

// Get wallet balance
const balance = await indexer.getBalance("YourWalletAddress...");

// Get classified transactions
const txs = await indexer.getTransactions("YourWalletAddress...", {
  limit: 10,
  filterSpam: true
});

// Get single transaction
const tx = await indexer.getTransaction("signature...");

// Access classification
console.log(tx.classification.primaryType); // "transfer", "swap", etc.
console.log(tx.classification.sender);
console.log(tx.classification.receiver);`}</code>
          </pre>
        </section>

        <section className="border border-neutral-200 rounded-lg p-8 bg-white">
          <h2 className="text-2xl font-semibold text-neutral-900 mb-4 lowercase">
            API reference
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2 lowercase">
                createIndexer(options)
              </h3>
              <p className="text-sm text-neutral-600 mb-3">
                Creates a new indexer instance.
              </p>
              <div className="bg-neutral-50 rounded p-3 border border-neutral-200">
                <p className="text-xs text-neutral-500 mb-1">Options:</p>
                <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
                  <li>
                    <code className="bg-white px-1 rounded">rpcUrl: string</code> - Solana RPC endpoint
                  </li>
                  <li>
                    <code className="bg-white px-1 rounded">wsUrl?: string</code> - Optional WebSocket URL
                  </li>
                  <li>
                    <code className="bg-white px-1 rounded">client?: SolanaClient</code> - Pre-configured client
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2 lowercase">
                getBalance(walletAddress, tokenMints?)
              </h3>
              <p className="text-sm text-neutral-600 mb-2">
                Fetches wallet balance including SOL and specified tokens.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2 lowercase">
                getTransactions(walletAddress, options?)
              </h3>
              <p className="text-sm text-neutral-600 mb-2">
                Fetches and classifies transactions for a wallet.
              </p>
              <div className="bg-neutral-50 rounded p-3 border border-neutral-200 mt-2">
                <p className="text-xs text-neutral-500 mb-1">Options:</p>
                <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
                  <li>
                    <code className="bg-white px-1 rounded">limit?: number</code> - Number of transactions (default: 10)
                  </li>
                  <li>
                    <code className="bg-white px-1 rounded">filterSpam?: boolean</code> - Filter spam (default: true)
                  </li>
                  <li>
                    <code className="bg-white px-1 rounded">enrichNftMetadata?: boolean</code> - Fetch NFT metadata (default: true)
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2 lowercase">
                getTransaction(signature, options?)
              </h3>
              <p className="text-sm text-neutral-600 mb-2">
                Fetches and classifies a single transaction by signature. Returns null if not found.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2 lowercase">
                getRawTransaction(signature)
              </h3>
              <p className="text-sm text-neutral-600 mb-2">
                Fetches raw transaction data without classification.
              </p>
            </div>
          </div>
        </section>

        <section className="border border-neutral-200 rounded-lg p-8 bg-white">
          <h2 className="text-2xl font-semibold text-neutral-900 mb-4 lowercase">
            transaction types
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-neutral-50 rounded border border-neutral-200">
              <code className="text-sm font-semibold text-neutral-900">transfer</code>
              <p className="text-xs text-neutral-600 mt-1">Wallet-to-wallet transfers</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded border border-neutral-200">
              <code className="text-sm font-semibold text-neutral-900">swap</code>
              <p className="text-xs text-neutral-600 mt-1">Token exchanges (any DEX)</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded border border-neutral-200">
              <code className="text-sm font-semibold text-neutral-900">nft_mint</code>
              <p className="text-xs text-neutral-600 mt-1">NFT minting</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded border border-neutral-200">
              <code className="text-sm font-semibold text-neutral-900">stake_deposit</code>
              <p className="text-xs text-neutral-600 mt-1">SOL staking deposits</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded border border-neutral-200">
              <code className="text-sm font-semibold text-neutral-900">stake_withdraw</code>
              <p className="text-xs text-neutral-600 mt-1">SOL staking withdrawals</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded border border-neutral-200">
              <code className="text-sm font-semibold text-neutral-900">bridge_in</code>
              <p className="text-xs text-neutral-600 mt-1">Receiving from bridge</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded border border-neutral-200">
              <code className="text-sm font-semibold text-neutral-900">bridge_out</code>
              <p className="text-xs text-neutral-600 mt-1">Sending to bridge</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded border border-neutral-200">
              <code className="text-sm font-semibold text-neutral-900">airdrop</code>
              <p className="text-xs text-neutral-600 mt-1">Token distributions</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded border border-neutral-200">
              <code className="text-sm font-semibold text-neutral-900">fee_only</code>
              <p className="text-xs text-neutral-600 mt-1">Only network fees</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded border border-neutral-200">
              <code className="text-sm font-semibold text-neutral-900">solana_pay</code>
              <p className="text-xs text-neutral-600 mt-1">Solana Pay payments</p>
            </div>
          </div>
        </section>

        <section className="border border-neutral-200 rounded-lg p-8 bg-white">
          <h2 className="text-2xl font-semibold text-neutral-900 mb-4 lowercase">
            examples
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2 lowercase">
                get wallet transaction history
              </h3>
              <pre className="p-4 bg-neutral-50 rounded border border-neutral-200 overflow-x-auto">
                <code className="text-sm">{`const txs = await indexer.getTransactions(walletAddress, {
  limit: 20,
  filterSpam: true,
  spamConfig: {
    minSolAmount: 0.001,
    minTokenAmountUsd: 0.01,
  }
});`}</code>
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2 lowercase">
                check if transaction is a swap
              </h3>
              <pre className="p-4 bg-neutral-50 rounded border border-neutral-200 overflow-x-auto">
                <code className="text-sm">{`const tx = await indexer.getTransaction(signature);
if (tx?.classification.primaryType === "swap") {
  const from = tx.classification.primaryAmount;
  const to = tx.classification.secondaryAmount;
  console.log(\`Swapped \${from.amountUi} \${from.token.symbol} for \${to.amountUi} \${to.token.symbol}\`);
}`}</code>
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2 lowercase">
                frontend perspective handling
              </h3>
              <pre className="p-4 bg-neutral-50 rounded border border-neutral-200 overflow-x-auto">
                <code className="text-sm">{`const tx = await indexer.getTransaction(signature);
const connectedWallet = wallet?.address;

if (connectedWallet === tx.classification.sender) {
  // "You sent..."
} else if (connectedWallet === tx.classification.receiver) {
  // "You received..."
}`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="border border-neutral-200 rounded-lg p-8 bg-white">
          <h2 className="text-2xl font-semibold text-neutral-900 mb-4 lowercase">
            RPC compatibility
          </h2>
          <p className="text-sm text-neutral-600 mb-4">
            Core features (transactions, balances, classification) work with any Solana RPC.
          </p>
          <p className="text-sm text-neutral-600 mb-4">
            NFT metadata enrichment requires a DAS-compatible RPC (Helius, Triton, etc.). If using a standard RPC, disable it:
          </p>
          <pre className="p-4 bg-neutral-50 rounded border border-neutral-200 overflow-x-auto">
            <code className="text-sm">{`const txs = await indexer.getTransactions(address, {
  enrichNftMetadata: false
});`}</code>
          </pre>
        </section>

        <section className="border border-neutral-200 rounded-lg p-8 bg-white">
          <h2 className="text-2xl font-semibold text-neutral-900 mb-4 lowercase">
            bundle size
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-4 font-semibold text-neutral-900">Import</th>
                  <th className="text-left py-2 px-4 font-semibold text-neutral-900">Size (minified + brotli)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-100">
                  <td className="py-2 px-4 font-mono text-xs">Full SDK</td>
                  <td className="py-2 px-4 text-neutral-600">11.34 KB</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-2 px-4 font-mono text-xs">createIndexer only</td>
                  <td className="py-2 px-4 text-neutral-600">11.34 KB</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-2 px-4 font-mono text-xs">classifyTransaction</td>
                  <td className="py-2 px-4 text-neutral-600">6.39 KB</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-2 px-4 font-mono text-xs">fetchTransaction</td>
                  <td className="py-2 px-4 text-neutral-600">7.39 KB</td>
                </tr>
                <tr className="border-b border-neutral-100">
                  <td className="py-2 px-4 font-mono text-xs">transactionToLegs</td>
                  <td className="py-2 px-4 text-neutral-600">7.3 KB</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-neutral-200 rounded-lg p-8 bg-white text-center">
          <p className="text-neutral-600 mb-6 lowercase">
            need more help? check out the repository
          </p>
          <a
            href="https://github.com/cxalem/tx-indexer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors lowercase"
          >
            view on github →
          </a>
        </section>
      </div>
    </div>
  );
}

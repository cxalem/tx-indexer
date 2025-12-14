import localFont from "next/font/local";
import Link from "next/link";

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

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="border border-neutral-200 rounded-lg p-6 bg-white">
          <h3 className="text-lg font-semibold text-neutral-900 mb-3 lowercase">
            getting started
          </h3>
          <p className="text-sm text-neutral-600 lowercase leading-relaxed">
            installation, basic setup, and your first transaction fetch
          </p>
        </div>

        <div className="border border-neutral-200 rounded-lg p-6 bg-white">
          <h3 className="text-lg font-semibold text-neutral-900 mb-3 lowercase">
            API reference
          </h3>
          <p className="text-sm text-neutral-600 lowercase leading-relaxed">
            complete guide to all SDK methods and types
          </p>
        </div>

        <div className="border border-neutral-200 rounded-lg p-6 bg-white">
          <h3 className="text-lg font-semibold text-neutral-900 mb-3 lowercase">
            examples
          </h3>
          <p className="text-sm text-neutral-600 lowercase leading-relaxed">
            real-world code samples and common use cases
          </p>
        </div>
      </div>

      <div className="border border-neutral-200 rounded-lg p-8 bg-white text-center">
        <p className="text-neutral-600 mb-6 lowercase">
          for now, check out our readme
        </p>
        <a
          href="https://github.com/cxalem/tx-indexer"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors lowercase"
        >
          view on github →
        </a>
      </div>
    </div>
  );
}

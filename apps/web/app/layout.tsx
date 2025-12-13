import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NoisyBackground } from "@/components/noisy-bg";
import { Nav } from "@/components/nav";
import { Providers } from "@/components/provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "itx - Solana Transaction Classifier SDK",
  description:
    "A TypeScript SDK that transforms raw Solana transactions into human-readable financial data. Automatically classifies swaps, transfers, and payments with protocol detection and confidence scoring.",
  keywords: [
    "solana",
    "blockchain",
    "transaction",
    "classifier",
    "sdk",
    "typescript",
    "defi",
    "web3",
  ],
  authors: [{ name: "cxalem", url: "https://github.com/cxalem" }],
  openGraph: {
    title: "itx - Solana Transaction Classifier SDK",
    description:
      "Transform raw Solana transactions into human-readable financial data with automatic classification and protocol detection.",
    url: "https://github.com/cxalem/tx-indexer",
    siteName: "itx",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "itx - Solana Transaction Classifier SDK",
    description:
      "Transform raw Solana transactions into human-readable financial data with automatic classification and protocol detection.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col`}
      >
        <Providers>
          <NoisyBackground />

          <div className="fixed inset-0 pointer-events-none -z-10">
            <div className="absolute inset-0 bg-linear-to-br from-neutral-50/20 via-transparent to-neutral-100/20" />

            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle, #737373 1px, transparent 1px)`,
                backgroundSize: "32px 32px",
                opacity: 0.4,
              }}
            />

            <div className="absolute top-0 left-1/4 w-96 h-96 bg-neutral-100/30 rounded-full blur-3xl" />
          </div>

          <Nav />

          <main className="grow">{children}</main>

          <footer className="border-t border-gray-300 bg-white/80 mt-20">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <span className="text-sm text-neutral-600">
                  © {new Date().getFullYear()} tx-indexer · MIT License
                </span>

                <a
                  href="https://github.com/cxalem/tx-indexer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-neutral-700 hover:text-black transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  GitHub
                </a>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

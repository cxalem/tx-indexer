import Link from "next/link";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

export function Nav() {
  return (
    <nav className="border-b border-gray-300 bg-white/80" data-print-hide>
      <div className="flex justify-between items-center p-4 max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-bold">
          itx
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/indexer"
            className="lowercase text-neutral-600 hover:text-black transition-colors"
          >
            indexer
          </Link>
          <Link
            href="/dashboard"
            className="lowercase text-neutral-600 hover:text-black transition-colors"
          >
            dashboard
          </Link>
          <Link
            href="/docs"
            className="lowercase text-neutral-600 hover:text-black transition-colors"
          >
            docs
          </Link>
          <ConnectWalletButton />
        </div>
      </div>
    </nav>
  );
}

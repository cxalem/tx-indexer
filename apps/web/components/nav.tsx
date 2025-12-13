import Link from "next/link";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

export function Nav() {
  return (
    <nav className="border-b border-gray-300 bg-white/80">
      <div className="flex justify-between items-center p-4 max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-bold">
          itx
        </Link>
        <ConnectWalletButton />
      </div>
    </nav>
  );
}

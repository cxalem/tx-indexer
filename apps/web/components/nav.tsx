"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Nav() {
  const handleConnectClick = () => {
    alert("🚧 Work in progress! Wallet connection coming soon.");
  };

  return (
    <nav className="border-b border-gray-300 bg-white/80">
      <div className="flex justify-between items-center p-4 max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-bold">
          itx
        </Link>
        <Button
          onClick={handleConnectClick}
          className="lowercase bg-vibrant-red text-white shadow-md hover:bg-vibrant-red/80 duration-400"
        >
          connect wallet
        </Button>
      </div>
    </nav>
  );
}


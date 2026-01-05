import localFont from "next/font/local";
import { ConnectWalletButton } from "./connect-wallet-button";

const bitcountFont = localFont({
  src: "../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export function Header() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className={`${bitcountFont.className} text-2xl text-neutral-900`}>
          <span className="text-vibrant-red">{"//"}</span> dashboard
        </h1>
        <ConnectWalletButton />
      </div>
    </header>
  );
}

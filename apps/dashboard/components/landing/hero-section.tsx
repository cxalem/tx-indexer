import localFont from "next/font/local";
import { HeroCTA } from "./hero-cta";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

export function HeroSection() {
  return (
    <section className="max-w-5xl mx-auto text-center py-20 px-4 md:my-5">
      <h1
        className={`${bitcountFont.className} text-5xl md:text-6xl text-neutral-900 dark:text-neutral-100 mb-6`}
      >
        <span className="text-vibrant-red">{"//"}</span> the solana transaction
        indexer
      </h1>
      <p className="text-xl text-neutral-600 dark:text-neutral-400 mb-4 max-w-2xl mx-auto lowercase">
        transforms raw blockchain data into human-readable transactions. swaps,
        transfers, NFT mints, all classified automatically.
      </p>
      <p className="text-base text-neutral-500 dark:text-neutral-400 mb-10 max-w-xl mx-auto lowercase">
        open source SDK for developers. dashboard for everyone.
      </p>

      <HeroCTA />
    </section>
  );
}

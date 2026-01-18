import type { Metadata } from "next";
import { Header } from "@/components/header";
import { NoisyBackground } from "@/components/noisy-bg";
import { GridBackground } from "@/components/grid-bg";

export const metadata: Metadata = {
  title: "itx-indexer | The Solana Transaction Indexer",
  description:
    "Transforms raw blockchain data into human-readable transactions. Swaps, transfers, NFT mints, all classified automatically. Open source SDK for developers.",
  openGraph: {
    title: "itx-indexer | The Solana Transaction Indexer",
    description:
      "Transforms raw blockchain data into human-readable transactions. Swaps, transfers, NFT mints, all classified automatically.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "itx-indexer | The Solana Transaction Indexer",
    description:
      "Transforms raw blockchain data into human-readable transactions. Open source SDK for developers.",
  },
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <NoisyBackground showDots />
      <GridBackground />
      <Header showMobileNav={false} />
      <main>{children}</main>
    </>
  );
}

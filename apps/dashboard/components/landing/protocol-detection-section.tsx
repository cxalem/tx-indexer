"use client";

import { useState } from "react";
import localFont from "next/font/local";

const bitcountFont = localFont({
  src: "../../app/fonts/Bitcount.ttf",
  variable: "--font-bitcount",
});

interface Protocol {
  name: string;
  logo: string;
}

// Row 1 protocols (scrolls left) - needs enough items to fill wide screens
const PROTOCOLS_ROW_1: Protocol[] = [
  { name: "Wormhole", logo: "/protocols/wormhole.webp" },
  { name: "Pump.fun", logo: "/protocols/pumpfun.webp" },
  { name: "Marinade", logo: "/protocols/marinade.webp" },
  { name: "Jito", logo: "/protocols/jito.webp" },
  { name: "Tensor", logo: "/protocols/tensor.webp" },
  { name: "Magic Eden", logo: "/protocols/magiceden.webp" },
  { name: "Drift", logo: "/protocols/drift.webp" },
  { name: "Kamino", logo: "/protocols/kamino.webp" },
  { name: "Marginfi", logo: "/protocols/marginfi.webp" },
  { name: "Solend", logo: "/protocols/solend.webp" },
  { name: "Jupiter", logo: "/protocols/jupiter.webp" },
  { name: "Raydium", logo: "/protocols/raydium.webp" },
  { name: "Orca", logo: "/protocols/orca.webp" },
  { name: "Sanctum", logo: "/protocols/sanctum.webp" },
  { name: "Meteora", logo: "/protocols/meteora.webp" },
  { name: "Phoenix", logo: "/protocols/phoenix.webp" },
];

// Row 2 protocols (scrolls right) - different order for variety
const PROTOCOLS_ROW_2: Protocol[] = [
  { name: "Lifinity", logo: "/protocols/lifinity.webp" },
  { name: "Metaplex", logo: "/protocols/metaplex.webp" },
  { name: "Solana Pay", logo: "/protocols/solanapay.webp" },
  { name: "Squads", logo: "/protocols/squads.webp" },
  { name: "Streamflow", logo: "/protocols/streamflow.webp" },
  { name: "Hawksight", logo: "/protocols/hawksight.webp" },
  { name: "Marginfi", logo: "/protocols/marginfi.webp" },
  { name: "Kamino", logo: "/protocols/kamino.webp" },
  { name: "Drift", logo: "/protocols/drift.webp" },
  { name: "Magic Eden", logo: "/protocols/magiceden.webp" },
  { name: "Tensor", logo: "/protocols/tensor.webp" },
  { name: "Jito", logo: "/protocols/jito.webp" },
  { name: "Marinade", logo: "/protocols/marinade.webp" },
  { name: "Pump.fun", logo: "/protocols/pumpfun.webp" },
  { name: "Wormhole", logo: "/protocols/wormhole.webp" },
  { name: "Jupiter", logo: "/protocols/jupiter.webp" },
];

function ProtocolPill({ protocol }: { protocol: Protocol }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full shrink-0">
      <div className="w-6 h-6 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0">
        {imgError ? (
          <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
            {protocol.name.charAt(0)}
          </span>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={protocol.logo}
            alt={protocol.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <span className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
        {protocol.name}
      </span>
    </div>
  );
}

function MarqueeRow({
  protocols,
  direction = "left",
}: {
  protocols: Protocol[];
  direction?: "left" | "right";
}) {
  // Triple the items to ensure no gaps on any screen size
  const tripled = [...protocols, ...protocols, ...protocols];

  return (
    <div className="relative overflow-hidden">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-neutral-50 dark:from-neutral-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-neutral-50 dark:from-neutral-950 to-transparent z-10 pointer-events-none" />

      <div
        className={`flex gap-3 w-fit ${
          direction === "left"
            ? "animate-marquee-left"
            : "animate-marquee-right"
        }`}
      >
        {tripled.map((protocol, index) => (
          <ProtocolPill key={`${protocol.name}-${index}`} protocol={protocol} />
        ))}
      </div>
    </div>
  );
}

export function ProtocolDetectionSection() {
  return (
    <section className="py-24 bg-white dark:bg-neutral-900 overflow-hidden my-20">
      <div className="max-w-5xl mx-auto px-4 mb-8">
        <h2
          className={`${bitcountFont.className} text-3xl text-neutral-600 dark:text-neutral-400 text-center mb-4`}
        >
          <span className="text-vibrant-red">{"//"}</span> protocol detection
        </h2>
        <p className="text-center text-neutral-500 dark:text-neutral-400 lowercase">
          10 protocols supported. more coming soon.
        </p>
      </div>

      <div className="space-y-3">
        <MarqueeRow protocols={PROTOCOLS_ROW_1} direction="left" />
        <MarqueeRow protocols={PROTOCOLS_ROW_2} direction="right" />
      </div>
    </section>
  );
}

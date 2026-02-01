"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { EnrichedTokenBalance } from "@/app/actions/token-metadata";
import type { TokenPriceData } from "@/app/actions/assets";
import { AssetRow } from "./asset-row";

interface AssetListWithHoverProps {
  tokens: EnrichedTokenBalance[];
  priceData: Map<string, TokenPriceData>;
  walletAddress: string;
}

export function AssetListWithHover({
  tokens,
  priceData,
  walletAddress,
}: AssetListWithHoverProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div onMouseLeave={() => setHoveredIndex(null)}>
      {tokens.map((token, index) => (
        <div
          key={token.mint}
          className="relative"
          onMouseEnter={() => setHoveredIndex(index)}
        >
          {/* Shared hover background with smooth transition */}
          <AnimatePresence>
            {hoveredIndex === index && (
              <motion.div
                layoutId="asset-hover"
                className="absolute inset-0 bg-neutral-50 dark:bg-neutral-800 z-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}
          </AnimatePresence>

          {/* Asset content - always on top */}
          <div className="relative z-10">
            <AssetRow
              token={token}
              priceData={priceData.get(token.mint) ?? null}
              walletAddress={walletAddress}
              disableHover
            />
          </div>
        </div>
      ))}
    </div>
  );
}

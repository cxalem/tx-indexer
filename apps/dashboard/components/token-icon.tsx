"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TokenIconProps {
  symbol: string;
  logoURI?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  xs: 14,
  sm: 16,
  md: 24,
  lg: 32,
};

export function TokenIcon({
  symbol,
  logoURI,
  size = "md",
  className,
}: TokenIconProps) {
  const [hasError, setHasError] = useState(false);
  const dimension = sizeMap[size];

  if (!logoURI || hasError) {
    return (
      <div
        className={cn(
          "rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 font-medium",
          className,
        )}
        style={{
          width: dimension,
          height: dimension,
          fontSize: dimension * 0.4,
        }}
      >
        {symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={logoURI}
      alt={symbol}
      width={dimension}
      height={dimension}
      className={cn("rounded-full", className)}
      onError={() => setHasError(true)}
      unoptimized
    />
  );
}

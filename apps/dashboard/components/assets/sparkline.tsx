"use client";

import { useMemo } from "react";
import type { PricePoint } from "@/app/actions/assets";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: PricePoint[];
  isPositive?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Downsample data to a target number of points using LTTB algorithm (simplified)
 * This keeps the visual shape while reducing noise
 */
function downsampleData(
  data: PricePoint[],
  targetPoints: number,
): PricePoint[] {
  if (data.length <= targetPoints) {
    return data;
  }

  const result: PricePoint[] = [];
  const bucketSize = (data.length - 2) / (targetPoints - 2);

  // Always keep first point
  result.push(data[0]!);

  for (let i = 0; i < targetPoints - 2; i++) {
    const bucketStart = Math.floor((i + 0) * bucketSize) + 1;
    const bucketEnd = Math.floor((i + 1) * bucketSize) + 1;

    // Find the point with max deviation in this bucket (simplified LTTB)
    let maxArea = -1;
    let maxIndex = bucketStart;

    for (let j = bucketStart; j < bucketEnd && j < data.length - 1; j++) {
      const area = Math.abs(data[j]!.price - data[bucketStart]!.price);
      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }

    result.push(data[maxIndex]!);
  }

  // Always keep last point
  result.push(data[data.length - 1]!);

  return result;
}

export function Sparkline({
  data,
  isPositive = true,
  width = 80,
  height = 24,
  className,
}: SparklineProps) {
  const path = useMemo(() => {
    if (data.length < 2) {
      return "";
    }

    // Downsample to ~20 points for a clean sparkline
    const sampledData = downsampleData(data, 20);

    const prices = sampledData.map((d) => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const padding = 2;
    const effectiveHeight = height - padding * 2;
    const effectiveWidth = width - padding * 2;

    const points = sampledData.map((point, i) => {
      const x = padding + (i / (sampledData.length - 1)) * effectiveWidth;
      const y =
        height -
        padding -
        ((point.price - minPrice) / priceRange) * effectiveHeight;
      return `${x},${y}`;
    });

    return `M${points.join(" L")}`;
  }, [data, width, height]);

  if (data.length < 2) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-neutral-400 dark:text-neutral-500 text-[10px]",
          className,
        )}
        style={{ width, height }}
      >
        --
      </div>
    );
  }

  const strokeColor = isPositive
    ? "stroke-green-500 dark:stroke-green-400"
    : "stroke-red-500 dark:stroke-red-400";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("flex-shrink-0", className)}
    >
      <path
        d={path}
        fill="none"
        className={cn("transition-colors", strokeColor)}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

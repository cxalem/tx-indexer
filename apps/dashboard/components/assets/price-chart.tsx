"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PricePoint, Timeframe } from "@/app/actions/assets";
import { cn } from "@/lib/utils";

interface PriceChartProps {
  data: PricePoint[];
  isPositive: boolean;
  timeframe: Timeframe;
  className?: string;
}

function formatPrice(price: number): string {
  if (price < 0.01) {
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
  }
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDate(timestamp: number, timeframe: Timeframe): string {
  const date = new Date(timestamp);

  if (timeframe === "24h") {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: PricePoint }>;
  timeframe: Timeframe;
}

function CustomTooltip({ active, payload, timeframe }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0];
  if (!data) return null;

  return (
    <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-2 py-1 rounded text-xs shadow-lg">
      <p className="font-mono font-medium">{formatPrice(data.value)}</p>
      <p className="text-neutral-400 dark:text-neutral-500 text-[10px]">
        {formatDate(data.payload.timestamp, timeframe)}
      </p>
    </div>
  );
}

export function PriceChart({
  data,
  isPositive,
  timeframe,
  className,
}: PriceChartProps) {
  const { minPrice, maxPrice, chartData } = useMemo(() => {
    if (data.length < 2) {
      return { minPrice: 0, maxPrice: 0, chartData: [] };
    }

    const prices = data.map((d) => d.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);

    // Add some padding to the domain
    const padding = (maxP - minP) * 0.1;

    return {
      minPrice: minP - padding,
      maxPrice: maxP + padding,
      chartData: data,
    };
  }, [data]);

  if (data.length < 2) {
    return (
      <div
        className={cn(
          "w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-500 text-sm",
          className,
        )}
      >
        no price data available
      </div>
    );
  }

  const strokeColor = isPositive ? "#22c55e" : "#ef4444";
  const gradientId = `price-gradient-${isPositive ? "green" : "red"}-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div className={cn("w-full h-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis dataKey="timestamp" hide />
          <YAxis domain={[minPrice, maxPrice]} hide />

          <Tooltip
            content={<CustomTooltip timeframe={timeframe} />}
            cursor={{
              stroke: isPositive ? "#22c55e" : "#ef4444",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
          />

          <Area
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

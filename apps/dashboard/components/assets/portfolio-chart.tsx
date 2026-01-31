"use client";

import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import type { PricePoint } from "@/app/actions/assets";
import { cn } from "@/lib/utils";

interface PortfolioChartProps {
  data: PricePoint[];
  isPositive: boolean;
  className?: string;
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: PricePoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0];
  if (!data) return null;

  const date = new Date(data.payload.timestamp);

  return (
    <div className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-2 py-1 rounded text-xs shadow-lg">
      <p className="font-mono font-medium">{formatPrice(data.value)}</p>
      <p className="text-neutral-400 dark:text-neutral-500 text-[10px]">
        {date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
      </p>
    </div>
  );
}

export function PortfolioChart({
  data,
  isPositive,
  className,
}: PortfolioChartProps) {
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
          "w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-500 text-xs",
          className,
        )}
      >
        no data
      </div>
    );
  }

  const strokeColor = isPositive ? "#22c55e" : "#ef4444";
  const gradientId = `portfolio-gradient-${isPositive ? "green" : "red"}`;

  return (
    <div className={cn("w-full h-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <Tooltip
            content={<CustomTooltip />}
            cursor={{
              stroke: strokeColor,
              strokeWidth: 1,
              strokeDasharray: "2 2",
            }}
          />

          <Area
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

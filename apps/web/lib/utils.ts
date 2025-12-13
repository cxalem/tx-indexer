import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a Solana address to a shortened version
 * @param address - Full Solana address
 * @param chars - Number of characters to show on each side (default: 4)
 * @returns Formatted address like "5k9X...zA6b"
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format a number with commas as thousands separators
 * @param num - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number like "1,234.56"
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format a timestamp to a readable date string
 * @param timestamp - Unix timestamp (in seconds or bigint)
 * @returns Formatted date like "Dec 11, 2025 3:30 PM"
 */
export function formatDate(timestamp: number | bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * Format a relative time from now
 * @param timestamp - Unix timestamp (in seconds or bigint)
 * @returns Relative time like "2 hours ago"
 */
export function formatRelativeTime(timestamp: number | bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(timestamp);
}


export function truncate(address: string): string {
  return address.slice(0, 4) + "..." + address.slice(-4);
}
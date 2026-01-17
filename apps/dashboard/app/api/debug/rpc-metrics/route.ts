import { NextResponse } from "next/server";
import {
  getMetricsSummary,
  clearMetrics,
  formatMetricsSummary,
} from "@/lib/rpc-metrics";

/**
 * GET /api/debug/rpc-metrics
 *
 * Returns RPC metrics comparing traditional vs signatures-first approaches.
 * Use ?format=text for ASCII table format.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const summary = getMetricsSummary();

  if (format === "text") {
    return new NextResponse(formatMetricsSummary(summary), {
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json(summary);
}

/**
 * DELETE /api/debug/rpc-metrics
 *
 * Clears all stored metrics.
 */
export async function DELETE() {
  clearMetrics();
  return NextResponse.json({ message: "Metrics cleared" });
}

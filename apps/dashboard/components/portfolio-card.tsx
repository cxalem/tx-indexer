import { type PortfolioSummary } from "@/app/actions/dashboard";
import { truncate } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import { PortfolioActions } from "@/components/portfolio-actions";
import { Wallet } from "lucide-react";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface PortfolioCardProps {
  portfolio: PortfolioSummary | null;
  walletAddress: string | null;
  onSend?: () => void;
  onTrade?: () => void;
}

export function PortfolioCard({
  portfolio,
  walletAddress,
  onSend,
  onTrade,
}: PortfolioCardProps) {
  const total = portfolio?.totalUsd ?? 0;
  const stablecoins = portfolio?.stablecoinsUsd ?? 0;
  const variable = portfolio?.variableAssetsUsd ?? 0;
  const unpriced = portfolio?.unpricedCount ?? 0;

  return (
    <div className="border border-neutral-200 rounded-lg bg-white p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-neutral-100 shrink-0">
            <Wallet className="h-5 w-5 text-neutral-600" />
          </div>
          <span className="text-neutral-500 shrink-0">portfolio</span>
          {walletAddress && (
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-sm text-neutral-400 font-mono truncate">
                {truncate(walletAddress)}
              </span>
              <CopyButton value={walletAddress} />
            </div>
          )}
        </div>
        <PortfolioActions
          walletAddress={walletAddress}
          onSend={onSend}
          onTrade={onTrade}
        />
      </div>
      <p className="text-2xl sm:text-3xl font-mono text-neutral-900 mb-2">
        {formatUsd(total)}
      </p>
      <p className="text-xs sm:text-sm text-neutral-500">
        <span className="whitespace-nowrap">
          stablecoins {formatUsd(stablecoins)}
        </span>
        <span className="mx-1">·</span>
        <span className="whitespace-nowrap">
          variable assets {formatUsd(variable)}
        </span>
        {unpriced > 0 && (
          <span className="text-neutral-400 whitespace-nowrap">
            {" "}
            · +{unpriced} unpriced
          </span>
        )}
      </p>
    </div>
  );
}

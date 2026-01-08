import { Skeleton } from "@/components/ui/skeleton";
import { Wallet } from "lucide-react";

export function PortfolioCardSkeleton() {
  return (
    <div className="border border-neutral-200 rounded-lg bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neutral-100">
            <Wallet className="h-5 w-5 text-neutral-400" />
          </div>
          <span className="text-neutral-500">portfolio</span>
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-9 w-40 mb-2" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}

export function TransactionRowSkeleton() {
  return (
    <div className="p-4 border-b border-neutral-100 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function TransactionsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <TransactionRowSkeleton key={i} />
      ))}
    </div>
  );
}

"use client";

export function AssetsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Portfolio Overview Skeleton */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="w-32 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="w-48 h-8 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="w-24 h-4 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
          <div className="w-full sm:w-48 h-16 rounded bg-neutral-100 dark:bg-neutral-800" />
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-4">
            <div className="w-20 h-4 rounded bg-neutral-100 dark:bg-neutral-800" />
            <div className="w-16 h-4 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
        </div>
      </div>

      {/* Tokens List Skeleton */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="w-12 h-3 rounded bg-neutral-100 dark:bg-neutral-800" />
            <div className="flex items-center gap-4">
              <div className="hidden sm:block w-8 h-3 rounded bg-neutral-100 dark:bg-neutral-800" />
              <div className="hidden sm:block w-12 h-3 rounded bg-neutral-100 dark:bg-neutral-800" />
              <div className="w-12 h-3 rounded bg-neutral-100 dark:bg-neutral-800" />
            </div>
          </div>
        </div>

        {/* Skeleton Rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <TokenRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function TokenRowSkeleton() {
  return (
    <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="space-y-1">
            <div className="w-12 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="w-20 h-3 rounded bg-neutral-100 dark:bg-neutral-800" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block w-16 h-4 rounded bg-neutral-100 dark:bg-neutral-800" />
          <div className="hidden sm:block w-20 h-6 rounded bg-neutral-100 dark:bg-neutral-800" />
          <div className="w-16 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="w-4 h-4 rounded bg-neutral-100 dark:bg-neutral-800" />
        </div>
      </div>
    </div>
  );
}

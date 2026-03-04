import { Skeleton } from "@/components/ui/skeleton";

export default function ToolsLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="page-header sticky top-0 z-10">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="page-header-sep" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-3 w-52 rounded" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      <div className="dashboard-content space-y-6">
        {/* Section header + period tabs */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32 rounded" />
          <Skeleton className="h-9 w-52 rounded-md" />
        </div>

        {/* 4 category summary cards */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="kpi-card space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              <Skeleton className="h-8 w-20 rounded" />
            </div>
          ))}
        </div>

        {/* Category + top-15 charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="chart-card space-y-4">
            <div className="chart-card-header">
              <Skeleton className="h-5 w-36 rounded" />
            </div>
            <div className="flex items-center justify-center py-4">
              <Skeleton className="h-48 w-48 rounded-full" />
            </div>
          </div>
          <div className="chart-card space-y-3">
            <div className="chart-card-header">
              <Skeleton className="h-5 w-40 rounded" />
            </div>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-28 rounded" />
                <div className="flex items-center gap-2 flex-1">
                  <Skeleton
                    className="h-2 rounded-full"
                    style={{ width: `${85 - i * 9}%` }}
                  />
                  <Skeleton className="h-3 w-10 rounded shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tool usage trend chart */}
        <div className="chart-card space-y-4">
          <div className="chart-card-header">
            <Skeleton className="h-5 w-48 rounded" />
          </div>
          <Skeleton className="h-56 rounded-lg" />
        </div>

        {/* Skills + subagents side-by-side */}
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((col) => (
            <div key={col} className="rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-24 rounded" />
              </div>
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-3 rounded" />
                      <Skeleton className="h-4 w-28 rounded" />
                    </div>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

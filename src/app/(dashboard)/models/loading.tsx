import { Skeleton } from "@/components/ui/skeleton";

export default function ModelsLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="page-header sticky top-0 z-10">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="page-header-sep" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-3 w-56 rounded" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      <div className="dashboard-content space-y-6">
        {/* Section header + period tabs */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-48 rounded" />
          <Skeleton className="h-9 w-52 rounded-md" />
        </div>

        {/* 3 KPI cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="kpi-card space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              <Skeleton className="h-8 w-24 rounded" />
            </div>
          ))}
        </div>

        {/* Pie chart + cost efficiency table */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Pie chart card */}
          <div className="chart-card space-y-4">
            <div className="chart-card-header">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-3 w-44 rounded" />
            </div>
            <div className="flex items-center justify-center py-4">
              <Skeleton className="h-52 w-52 rounded-full" />
            </div>
          </div>

          {/* Cost efficiency card */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-5 w-36 rounded" />
            </div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right space-y-1">
                      <Skeleton className="h-4 w-16 rounded" />
                      <Skeleton className="h-3 w-8 rounded" />
                    </div>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily cost trend chart */}
        <div className="chart-card space-y-4">
          <div className="chart-card-header">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-3 w-36 rounded" />
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>

        {/* Detail table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b">
            <Skeleton className="h-5 w-36 rounded" />
          </div>
          <div className="p-0">
            {/* Table header */}
            <div className="flex gap-4 px-4 py-3 bg-muted/50 border-b">
              {[40, 20, 20, 20, 20, 16, 12].map((w, i) => (
                <Skeleton key={i} className="h-3 rounded" style={{ width: `${w}%` }} />
              ))}
            </div>
            {/* Table rows */}
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
                <div className="space-y-1" style={{ width: "40%" }}>
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton className="h-3 w-36 rounded" />
                </div>
                {[20, 20, 20, 20, 16].map((w, j) => (
                  <Skeleton key={j} className="h-4 rounded" style={{ width: `${w}%` }} />
                ))}
                <div className="flex items-center gap-2" style={{ width: "12%" }}>
                  <Skeleton className="h-2 w-12 rounded-full" />
                  <Skeleton className="h-3 w-8 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

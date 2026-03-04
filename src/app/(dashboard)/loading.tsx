import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="page-header sticky top-0 z-10">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="page-header-sep" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-48 rounded" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      <div className="dashboard-content">
        {/* Section header skeleton */}
        <div className="dashboard-section-header">
          <Skeleton className="h-7 w-40 rounded" />
          <Skeleton className="h-9 w-52 rounded-md" />
        </div>

        {/* KPI cards skeleton */}
        <div className="kpi-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="kpi-card space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              <Skeleton className="h-8 w-28 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
            </div>
          ))}
        </div>

        {/* Charts row 1 skeleton */}
        <div className="chart-grid-2">
          <div className="chart-card space-y-4">
            <div className="chart-card-header">
              <Skeleton className="h-5 w-36 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
            <Skeleton className="h-52 rounded-lg" />
          </div>
          <div className="chart-card space-y-4">
            <div className="chart-card-header">
              <Skeleton className="h-5 w-36 rounded" />
              <Skeleton className="h-3 w-40 rounded" />
            </div>
            <Skeleton className="h-52 rounded-lg" />
          </div>
        </div>

        {/* Charts row 2 skeleton */}
        <div className="chart-grid-2">
          <div className="chart-card space-y-4">
            <div className="chart-card-header">
              <Skeleton className="h-5 w-36 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
            <Skeleton className="h-52 rounded-lg" />
          </div>
          <div className="chart-card space-y-3">
            <div className="chart-card-header">
              <Skeleton className="h-5 w-44 rounded" />
              <Skeleton className="h-3 w-36 rounded" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
                <Skeleton className="h-2 rounded-full" style={{ width: `${75 - i * 12}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

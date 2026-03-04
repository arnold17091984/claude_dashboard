import { Skeleton } from "@/components/ui/skeleton";

export default function InsightsLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="page-header sticky top-0 z-10">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="page-header-sep" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-3 w-48 rounded" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      <div className="dashboard-content space-y-6">
        {/* Section header + generate button */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-36 rounded" />
          <Skeleton className="h-9 w-44 rounded-md" />
        </div>

        {/* Insight cards — each has a header with icon/badge/timestamp + body text */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card overflow-hidden">
            {/* Card header */}
            <div className="px-6 pt-6 pb-4 space-y-3 border-b">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-md shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-32 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-3 w-3 rounded" />
                  <Skeleton className="h-3 w-28 rounded" />
                </div>
              </div>
            </div>

            {/* Card body — multi-line text skeleton */}
            <div className="px-6 py-4 space-y-2">
              {[...Array(i === 0 ? 6 : i === 1 ? 4 : 5)].map((_, j) => (
                <Skeleton
                  key={j}
                  className="h-3.5 rounded"
                  style={{ width: j === (i === 0 ? 5 : i === 1 ? 3 : 4) ? "60%" : "100%" }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function SessionsLoading() {
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

      <div className="dashboard-content">
        {/* Section header + period tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-36 rounded" />
            <Skeleton className="h-4 w-28 rounded" />
          </div>
          <Skeleton className="h-9 w-52 rounded-md" />
        </div>

        {/* Session list skeleton — mimics the card with dividers */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b last:border-0"
            >
              {/* Left: project name + metadata row */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded shrink-0" />
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-3 w-12 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>

              {/* Right: message + tool counts */}
              <div className="flex items-center gap-4 shrink-0">
                <Skeleton className="h-4 w-8 rounded" />
                <Skeleton className="h-4 w-8 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex items-center justify-center gap-4">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}

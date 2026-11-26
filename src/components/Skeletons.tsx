/**
 * Dimension-matched skeleton placeholders for zero-CLS initial loading across
 * Project Listings, Services, Member Vault, and Admin Verification Queues.
 */

export function ProjectListingSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading verified marketplace listings"
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex min-h-[246px] flex-col rounded-xl border border-ink/10 bg-[#FCFBF8] p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-5 w-24 animate-pulse rounded bg-ink/10" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-ink/10" />
          </div>
          <div className="mt-3 h-6 w-3/4 animate-pulse rounded bg-ink/10" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-ink/8" />
          <div className="mt-3 space-y-1.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-ink/8" />
            <div className="h-3.5 w-5/6 animate-pulse rounded bg-ink/8" />
          </div>
          <div className="mt-auto space-y-2.5 border-t border-ink/10 pt-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 animate-pulse rounded bg-ink/10" />
              <div className="h-4 w-24 animate-pulse rounded bg-ink/8" />
            </div>
            <div className="h-11 w-full animate-pulse rounded-md bg-ink/10" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ServiceListingSkeletonGrid({ count = 2 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading verified services"
      className="grid gap-5 md:grid-cols-2"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex min-h-[268px] flex-col rounded-2xl border border-ink/10 bg-[#FCFBF8] p-6"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-5 w-28 animate-pulse rounded-full bg-ink/10" />
            <div className="h-5 w-24 animate-pulse rounded bg-ink/10" />
          </div>
          <div className="mt-3 h-7 w-2/3 animate-pulse rounded bg-ink/10" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-ink/8" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-ink/8" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-ink/8" />
          </div>
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
            <div className="h-4 w-36 animate-pulse rounded bg-ink/8" />
            <div className="flex gap-2">
              <div className="h-11 w-32 animate-pulse rounded-md bg-ink/10" />
              <div className="h-11 w-28 animate-pulse rounded-md bg-ink/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardWorkspaceSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading member workspace"
      className="min-h-[100dvh] bg-paper pb-24 pt-28 text-ink"
    >
      <div className="mx-auto w-full max-w-[1920px] space-y-6 px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="min-h-[118px] animate-pulse rounded-xl bg-ink/12" />
        <div className="min-h-[96px] animate-pulse rounded-xl bg-ink/10" />
        <div className="min-h-[220px] animate-pulse rounded-xl bg-ink/10" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-h-[144px] animate-pulse rounded-xl bg-ink/10" />
          <div className="min-h-[144px] animate-pulse rounded-xl bg-ink/10" />
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="min-h-[340px] animate-pulse rounded-xl bg-ink/10" />
          <div className="min-h-[340px] animate-pulse rounded-xl bg-ink/10 lg:col-span-2" />
        </div>
      </div>
    </div>
  )
}

export function AdminGovernanceSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading admin governance console"
      className="min-h-[100dvh] bg-paper pb-24 pt-28 text-ink"
    >
      <div className="mx-auto w-full max-w-[1920px] space-y-6 px-4 sm:px-6 lg:px-8 xl:px-10">
        {/* Header + nav pill bar geometry */}
        <div className="min-h-[208px] rounded-xl border border-ink/12 bg-ink/90 p-6 lg:p-8">
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-52 animate-pulse rounded-full bg-paper/15" />
            <div className="h-6 w-40 animate-pulse rounded-full bg-paper/15" />
          </div>
          <div className="mt-4 h-9 w-80 max-w-full animate-pulse rounded bg-paper/15" />
          <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-paper/10" />
          <div className="mt-6 flex flex-wrap gap-2 border-t border-paper/10 pt-5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-[38px] w-36 animate-pulse rounded-lg bg-paper/10"
              />
            ))}
          </div>
        </div>
        {/* 6 KPI cards geometry */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[104px] animate-pulse rounded-xl border border-ink/10 bg-[#FCFBF8] p-4"
            >
              <div className="h-3 w-24 rounded bg-ink/10" />
              <div className="mt-4 h-8 w-12 rounded bg-ink/15" />
            </div>
          ))}
        </div>
        {/* Queue list rows geometry */}
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-[#FCFBF8] p-6">
          <div className="h-6 w-64 animate-pulse rounded bg-ink/10" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[96px] animate-pulse rounded-xl border border-ink/8 bg-paper/70"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface Props {
  count?: number
}

export default function SkeletonLoader({ count = 4 }: Props) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-16 rounded-full bg-slate-200" />
        <div className="h-4 w-40 rounded bg-slate-200" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-5/6 rounded bg-slate-100" />
        <div className="h-3 w-4/6 rounded bg-slate-100" />
      </div>
      <div className="flex gap-2 mt-3">
        <div className="h-5 w-20 rounded-full bg-slate-100" />
        <div className="h-5 w-24 rounded-full bg-slate-100" />
      </div>
    </div>
  )
}

/** Full-page analysis skeleton with a left column and right column layout */
export function AnalysisSkeletonLayout({ clauseCount = 4 }: { clauseCount?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
          <div className="h-5 w-24 rounded-full bg-indigo-100 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-24 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-5 w-28 rounded-full bg-slate-100 animate-pulse" />
        </div>
      </div>

      <div className="flex divide-x divide-slate-100">
        {/* Left: clause cards */}
        <div className="flex-1 p-5 space-y-3 min-w-0">
          <SkeletonLoader count={clauseCount} />
        </div>

        {/* Right: report skeleton */}
        <div className="w-[420px] flex-shrink-0 p-5 hidden xl:block">
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-24 rounded bg-slate-200" />
            {[1, 0.9, 0.8, 1, 0.7, 0.85, 0.6].map((w, i) => (
              <div key={i} className="h-3 rounded bg-slate-100" style={{ width: `${w * 100}%` }} />
            ))}
            <div className="h-4 w-32 rounded bg-slate-200 mt-5" />
            {[0.95, 0.75, 0.8].map((w, i) => (
              <div key={i} className="h-3 rounded bg-slate-100" style={{ width: `${w * 100}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

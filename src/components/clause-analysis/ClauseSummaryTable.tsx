import type { ClauseAnalysis, ClauseResult } from '../../types/clauseAnalysis'
import { STATUS_CONFIG } from '../../types/clauseAnalysis'

interface Props {
  results: ClauseAnalysis[]
}

const STATUSES: ClauseResult[] = ['MATCH', 'VIOLATION', 'PARTIALLY_SATISFIED', 'NOT_FOUND']

export default function ClauseSummaryTable({ results }: Props) {
  const counts = results.reduce<Record<string, number>>((acc, item) => {
    acc[item.result] = (acc[item.result] || 0) + 1
    return acc
  }, {})

  const matchRate = results.length
    ? Math.round(((counts.MATCH || 0) / results.length) * 100)
    : 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUSES.map((status) => {
        const n = counts[status] || 0
        if (!n) return null
        const cfg = STATUS_CONFIG[status]
        return (
          <span
            key={status}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold border ${cfg.border} ${cfg.bg} ${cfg.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}: {n}
          </span>
        )
      })}

      <span className="ml-auto text-xs text-slate-400 tabular-nums">
        {results.length} clause{results.length !== 1 ? 's' : ''} · {matchRate}% match
      </span>
    </div>
  )
}

import type { Clause } from '../../types/clauseAnalysis'
import ClauseRow from './ClauseRow'

interface Props {
  clauses: Clause[]
  onAdd: () => void
  onChange: (id: string, field: keyof Clause, value: string) => void
  onRemove: (id: string) => void
}

export default function ClauseForm({ clauses, onAdd, onChange, onRemove }: Props) {
  // Find duplicate IDs
  const idCounts = clauses.reduce<Record<string, number>>((acc, c) => {
    const key = c.id.trim().toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const duplicateIds = new Set(Object.entries(idCounts).filter(([, n]) => n > 1).map(([id]) => id))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          2. Clauses&nbsp;
          <span className="text-indigo-600 font-bold">{clauses.length}</span>
          {duplicateIds.size > 0 && (
            <span className="ml-2 text-red-500 normal-case font-semibold">
              · {duplicateIds.size} duplicate {duplicateIds.size === 1 ? 'ID' : 'IDs'}
            </span>
          )}
        </h2>
        <button
          onClick={onAdd}
          disabled={clauses.length >= 100}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Clause
        </button>
      </div>

      {/* Clause list */}
      <div className="p-4 space-y-3 max-h-[58vh] overflow-y-auto">
        {clauses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">No clauses yet.</p>
            <button onClick={onAdd} className="mt-2 text-xs text-indigo-600 font-semibold hover:underline">
              Add your first clause →
            </button>
          </div>
        ) : (
          clauses.map((clause, i) => (
            <ClauseRow
              key={clause.id + i}
              clause={clause}
              index={i}
              isDuplicate={duplicateIds.has(clause.id.trim().toLowerCase())}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))
        )}
      </div>

      {clauses.length >= 100 && (
        <div className="px-5 py-2 bg-amber-50 border-t border-amber-100">
          <p className="text-xs text-amber-700 text-center">Maximum 100 clauses reached.</p>
        </div>
      )}
    </div>
  )
}

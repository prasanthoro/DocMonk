import { useId } from 'react'
import type { Clause, ClauseCategory } from '../../types/clauseAnalysis'
import { CLAUSE_CATEGORIES } from '../../types/clauseAnalysis'

interface Props {
  clause: Clause
  index: number
  isDuplicate?: boolean
  onChange: (id: string, field: keyof Clause, value: string) => void
  onRemove: (id: string) => void
}

/** Converts a title string into a URL-safe slug for use as clause ID */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'clause'
}

export default function ClauseRow({ clause, index, isDuplicate, onChange, onRemove }: Props) {
  const labelId = useId()

  return (
    <div
      className={[
        'rounded-xl border bg-white p-4 shadow-sm group transition',
        isDuplicate ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        {/* Index badge */}
        <span className="mt-2.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold select-none">
          {index + 1}
        </span>

        <div className="flex-1 space-y-2.5">
          {/* Title + category row */}
          <div className="flex gap-2">
            <input
              id={labelId}
              type="text"
              placeholder="Clause title…"
              value={clause.title}
              onChange={(e) => {
                const title = e.target.value
                onChange(clause.id, 'title', title)
                // Auto-update the ID slug from the title
                onChange(clause.id, 'id', slugify(title))
              }}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <select
              value={clause.category}
              onChange={(e) => onChange(clause.id, 'category', e.target.value as ClauseCategory)}
              className="w-[118px] rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-700 bg-white focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {CLAUSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* ID field (editable slug) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono flex-shrink-0">ID:</span>
            <input
              type="text"
              value={clause.id}
              onChange={(e) => onChange(clause.id, 'id', e.target.value.replace(/\s/g, '_').toLowerCase())}
              className={[
                'flex-1 rounded-md border px-2 py-1 text-xs font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100',
                isDuplicate
                  ? 'border-red-300 bg-red-50 focus:border-red-400'
                  : 'border-slate-200 bg-slate-50 focus:border-indigo-400',
              ].join(' ')}
            />
            {isDuplicate && (
              <span className="text-xs text-red-600 font-semibold flex-shrink-0">Duplicate ID</span>
            )}
          </div>

          {/* Value textarea */}
          <textarea
            placeholder="Expected clause language or description…"
            value={clause.value}
            onChange={(e) => onChange(clause.id, 'value', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
          />
        </div>

        {/* Remove button */}
        <button
          onClick={() => onRemove(clause.id)}
          title="Remove clause"
          className="mt-1.5 rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

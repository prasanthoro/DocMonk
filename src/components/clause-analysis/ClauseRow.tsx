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

const CATEGORY_COLORS: Record<string, string> = {
  financial:      'bg-emerald-100 text-emerald-700',
  legal:          'bg-blue-100 text-blue-700',
  penalty:        'bg-red-100 text-red-700',
  risk:           'bg-orange-100 text-orange-700',
  termination:    'bg-rose-100 text-rose-700',
  confidentiality:'bg-purple-100 text-purple-700',
  core:           'bg-indigo-100 text-indigo-700',
  operational:    'bg-cyan-100 text-cyan-700',
  statutory:      'bg-teal-100 text-teal-700',
  usage:          'bg-sky-100 text-sky-700',
  execution:      'bg-violet-100 text-violet-700',
  other:          'bg-slate-100 text-slate-600',
}

export default function ClauseRow({ clause, index, isDuplicate, onChange, onRemove }: Props) {
  const labelId = useId()
  const catColor = CATEGORY_COLORS[clause.category] ?? CATEGORY_COLORS.other

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isDuplicate
        ? 'border-red-300 bg-red-50/40 shadow-sm shadow-red-100'
        : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm'
    }`}>

      {/* ── Top row: index · title · delete ── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="h-5 w-5 flex-shrink-0 flex items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-black select-none">
          {index + 1}
        </span>
        <input
          id={labelId}
          type="text"
          placeholder="Clause title…"
          value={clause.title}
          onChange={(e) => {
            const title = e.target.value
            onChange(clause.id, 'title', title)
            onChange(clause.id, 'id', slugify(title))
          }}
          className="flex-1 text-sm font-semibold text-slate-800 placeholder-slate-400 border-none outline-none bg-transparent min-w-0"
        />
        <button
          onClick={() => onRemove(clause.id)}
          title="Delete clause"
          className="h-6 w-6 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </button>
      </div>

      {/* ── Meta row: category badge · id slug ── */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <select
          value={clause.category}
          onChange={(e) => onChange(clause.id, 'category', e.target.value as ClauseCategory)}
          className={`rounded-full border-0 px-2.5 py-0.5 text-[10px] font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-100 ${catColor}`}
        >
          {CLAUSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <span className="text-[10px] text-slate-300 select-none">·</span>

        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">id:</span>
          <input
            type="text"
            value={clause.id}
            onChange={(e) => onChange(clause.id, 'id', e.target.value.replace(/\s/g, '_').toLowerCase())}
            className={`flex-1 text-[10px] font-mono bg-transparent border-none outline-none min-w-0 ${
              isDuplicate ? 'text-red-500 font-bold' : 'text-slate-400 focus:text-slate-600'
            }`}
          />
          {isDuplicate && (
            <span className="text-[9px] font-black text-red-500 bg-red-100 rounded px-1 flex-shrink-0">DUP</span>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="h-px bg-slate-100 mx-3" />

      {/* ── Value textarea ── */}
      <textarea
        placeholder="Expected clause language or description…"
        value={clause.value}
        onChange={(e) => onChange(clause.id, 'value', e.target.value)}
        rows={2}
        className="w-full px-3 py-2.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none resize-none bg-transparent leading-relaxed"
      />
    </div>
  )
}

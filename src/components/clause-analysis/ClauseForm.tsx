import { useState } from 'react'
import type { Clause, ClauseCategory } from '../../types/clauseAnalysis'
import { CLAUSE_CATEGORIES } from '../../types/clauseAnalysis'
import ClauseRow from './ClauseRow'
import { slugify } from './ClauseRow'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  clauses: Clause[]
  onAdd: () => void
  onChange: (id: string, field: keyof Clause, value: string) => void
  onRemove: (id: string) => void
  onClearAll?: () => void
  onReplace?: (clauses: Clause[]) => void
}

// ─── JSON import parser ───────────────────────────────────────────────────────

function parseClausesJson(raw: string): { clauses: Clause[]; error: string | null } {
  try {
    const parsed = JSON.parse(raw)
    const arr: any[] = Array.isArray(parsed) ? parsed : parsed?.clauses ?? []
    if (!Array.isArray(arr) || arr.length === 0) {
      return { clauses: [], error: 'Expected a JSON array of clauses.' }
    }
    const clauses: Clause[] = arr.map((item, i) => {
      const title = String(item.title || item.name || `Clause ${i + 1}`).trim()
      const rawCat = String(item.category || 'other').toLowerCase() as ClauseCategory
      const validCats = CLAUSE_CATEGORIES.map((c) => c.value)
      const category: ClauseCategory = validCats.includes(rawCat) ? rawCat : 'other'
      const value = String(item.content || item.value || item.description || '').trim()
      const id = String(item.id || slugify(title) || uuidv4().slice(0, 8))
      return { id, title, category, value }
    })
    return { clauses, error: null }
  } catch {
    return { clauses: [], error: 'Invalid JSON. Please paste a valid JSON array.' }
  }
}

export default function ClauseForm({ clauses, onAdd, onChange, onRemove, onClearAll, onReplace }: Props) {
  const [showJson, setShowJson] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)

  const idCounts = clauses.reduce<Record<string, number>>((acc, c) => {
    const key = c.id.trim().toLowerCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const duplicateIds = new Set(Object.entries(idCounts).filter(([, n]) => n > 1).map(([id]) => id))
  const validCount = clauses.filter((c) => c.title.trim() && c.value.trim()).length

  const handleJsonImport = () => {
    if (!jsonText.trim()) { setJsonError('Paste your JSON first.'); return }
    const { clauses: imported, error } = parseClausesJson(jsonText)
    if (error) { setJsonError(error); return }
    setJsonError(null)
    onReplace?.(imported)
    setJsonText('')
    setShowJson(false)
  }

  const exampleJson = JSON.stringify([
    { id: 'c1', title: 'Rent Amount', category: 'financial', content: 'Monthly rent shall be Rs. 75,000 payable by the 5th of every month.' },
    { id: 'c2', title: 'Security Deposit', category: 'financial', content: 'Tenant shall deposit Rs. 10,00,000 as refundable security deposit.' },
    { id: 'c3', title: 'Lock-in Period', category: 'termination', content: 'The agreement shall have a lock-in period of 12 months.' },
  ], null, 2)

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">
            <span className="font-bold text-indigo-600">{validCount}</span>
            <span className="text-slate-400">/{clauses.length} ready</span>
          </span>
          {duplicateIds.size > 0 && (
            <span className="text-[11px] font-semibold text-red-500 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
              {duplicateIds.size} duplicate ID{duplicateIds.size > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setShowJson((v) => !v); setJsonError(null) }}
            title="Import clauses from JSON"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
              showJson
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
            </svg>
            JSON
          </button>
          {clauses.length > 1 && onClearAll && (
            <button
              onClick={() => { if (window.confirm('Clear all clauses?')) onClearAll() }}
              className="text-[11px] text-slate-400 hover:text-red-500 font-semibold transition px-1"
            >
              Clear
            </button>
          )}
          <button
            onClick={onAdd}
            disabled={clauses.length >= 100}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
        </div>
      </div>

      {/* JSON Import Panel */}
      {showJson && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="text-indigo-600" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
              </svg>
              <span className="text-xs font-bold text-indigo-800">Import Clauses from JSON</span>
            </div>
            <button
              onClick={() => { setShowJson(false); setJsonError(null); setJsonText('') }}
              className="text-indigo-400 hover:text-indigo-600"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="p-3 space-y-2.5">
            <p className="text-[11px] text-indigo-700 leading-relaxed">
              Paste a JSON array with <code className="bg-indigo-100 px-1 rounded text-indigo-800">id</code>, <code className="bg-indigo-100 px-1 rounded text-indigo-800">title</code>, <code className="bg-indigo-100 px-1 rounded text-indigo-800">category</code>, and <code className="bg-indigo-100 px-1 rounded text-indigo-800">content</code> fields.
            </p>
            <textarea
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonError(null) }}
              placeholder={exampleJson}
              rows={7}
              spellCheck={false}
              className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2.5 text-[11px] font-mono text-slate-700 placeholder-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none leading-relaxed"
            />
            {jsonError && (
              <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {jsonError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleJsonImport}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 active:scale-95"
              >
                Import & Replace Clauses
              </button>
              <button
                onClick={() => { setShowJson(false); setJsonText(''); setJsonError(null) }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:border-slate-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clause list */}
      <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-0.5">
        {clauses.length === 0 ? (
          <div className="text-center py-8 rounded-xl border-2 border-dashed border-slate-200">
            <p className="text-sm text-slate-400 mb-1.5">No clauses yet</p>
            <button onClick={onAdd} className="text-xs text-indigo-600 font-semibold hover:underline">
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
        <p className="text-xs text-amber-700 text-center bg-amber-50 border border-amber-100 rounded-lg py-2">
          Maximum 100 clauses reached.
        </p>
      )}
    </div>
  )
}

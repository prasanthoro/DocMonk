import { useState } from 'react'
import type { ClauseAnalysis } from '../../types/clauseAnalysis'
import { STATUS_CONFIG } from '../../types/clauseAnalysis'

interface Props {
  item: ClauseAnalysis
}

export default function ClauseResultCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[item.result] ?? STATUS_CONFIG.NOT_FOUND

  const hasDetails = !!(item.relevant_text || item.ai_added_text || item.clause_content)

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <div className="px-5 py-4">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border ${cfg.border} bg-white ${cfg.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              <h4 className={`font-semibold text-sm ${cfg.text} truncate`}>{item.clause_title}</h4>
            </div>

            {/* Reason */}
            <p className="text-sm text-slate-600 leading-relaxed">{item.reason}</p>
          </div>
        </div>

        {/* Metadata chips */}
        {(item.binding_strength ||
          item.parties_obligated?.length ||
          item.key_dates_durations?.length ||
          item.missing_values?.length) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.binding_strength && (
              <Chip label={item.binding_strength} />
            )}
            {item.parties_obligated?.map((p) => (
              <Chip key={p} label={p} />
            ))}
            {item.key_dates_durations?.map((d) => (
              <Chip key={d} label={d} color="indigo" />
            ))}
            {item.missing_values?.map((m) => (
              <Chip key={m} label={`Missing: ${m}`} color="red" />
            ))}
          </div>
        )}

        {/* Toggle details */}
        {hasDetails && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className={`mt-3 text-xs font-semibold ${cfg.text} flex items-center gap-1 hover:opacity-75 transition`}
          >
            {expanded ? 'Hide' : 'Show'} details
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="border-t border-black/5 bg-white px-5 py-4 space-y-4">
          {item.relevant_text && (
            <DetailSection label="Relevant text in document">
              <blockquote className="text-sm text-slate-600 border-l-2 border-slate-300 pl-3 italic leading-relaxed">
                {item.relevant_text}
              </blockquote>
            </DetailSection>
          )}
          {item.clause_content && (
            <DetailSection label="Your clause">
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                {item.clause_content}
              </p>
            </DetailSection>
          )}
          {item.ai_added_text && (
            <DetailSection label="AI suggested language">
              <p className="text-sm text-indigo-800 bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100 leading-relaxed">
                {item.ai_added_text}
              </p>
            </DetailSection>
          )}
        </div>
      )}
    </div>
  )
}

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function Chip({
  label,
  color = 'slate',
}: {
  label: string
  color?: 'slate' | 'indigo' | 'red'
}) {
  const styles: Record<string, string> = {
    slate: 'text-slate-500 bg-white border-slate-200',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    red: 'text-red-600 bg-red-50 border-red-100',
  }
  return (
    <span className={`text-xs border rounded-full px-2 py-0.5 ${styles[color]}`}>{label}</span>
  )
}

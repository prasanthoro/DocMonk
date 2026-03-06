import type { AnalysisResponse } from '../../types/clauseAnalysis'
import { AnalysisSkeletonLayout } from './SkeletonLoader'
import { decodeBase64 } from '../../utils/base64'
import { markdownToHtml } from '../../utils/markdownToHtml'

interface Props {
  result: AnalysisResponse | null
  isLoading: boolean
  clauseCount?: number
}

export default function AnalysisResults({ result, isLoading, clauseCount = 4 }: Props) {
  if (isLoading) {
    return <AnalysisSkeletonLayout clauseCount={clauseCount} />
  }

  if (!result) return null

  const summary = result.analysis_summary ?? []

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

      {/* ── Header ── */}


      {/* ── Body ── */}
      <div className="flex flex-col xl:flex-row">


        {result.summary_md_base64 && (
          <div className="xl:w-full xl:flex-shrink-0 border-t xl:border-t-0 border-slate-100">
            <SummaryPanel base64={result.summary_md_base64} />
          </div>
        )}

      </div>

      {/* ── Conflicts ── */}
      {result.conflicts && result.conflicts.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
            Conflicts Detected ({result.conflicts.length})
          </h3>
          <div className="space-y-2">
            {result.conflicts.map((conflict, i) => (
              <div key={i} className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {conflict.clause_ids?.map((id: string) => (
                    <span key={id} className="text-xs font-mono text-orange-700 bg-orange-100 rounded px-1.5 py-0.5">
                      {id}
                    </span>
                  ))}
                  {conflict.severity && (
                    <span className="text-xs font-semibold text-orange-600 ml-auto">
                      {conflict.severity}
                    </span>
                  )}
                </div>
                <p className="text-sm text-orange-800">{conflict.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Summary panel ────────────────────────────────────────────────────────────

function SummaryPanel({ base64 }: { base64: string }) {
  const raw = decodeBase64(base64)
  if (!raw) return null
  const html = markdownToHtml(raw)

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
        <h3 className="text-sm font-bold text-slate-800">Analysis Summary</h3>
      </div>
      <div
        className="flex-1 overflow-y-auto px-5 py-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg className="text-slate-300 mb-3" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

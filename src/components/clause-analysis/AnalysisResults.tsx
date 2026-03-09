import { useRef, useState } from 'react'
import type { AnalysisResponse } from '../../types/clauseAnalysis'
import { AnalysisSkeletonLayout } from './SkeletonLoader'
import { decodeBase64 } from '../../utils/base64'

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
  const conflicts = result.conflicts ?? []

  // ── Status counts ──
  const counts = summary.reduce<Record<string, number>>((acc, item) => {
    acc[item.result] = (acc[item.result] || 0) + 1
    return acc
  }, {})

  const violations = counts['VIOLATION'] || 0
  const matches = counts['MATCH'] || 0
  const partial = counts['PARTIALLY_SATISFIED'] || 0
  const notFound = counts['NOT_FOUND'] || 0
  const total = summary.length

  // ── Risk score (0–100, lower = better) ──
  const riskScore = total > 0 ? Math.round(((violations * 3 + notFound * 1.5 + partial) / (total * 3)) * 100) : 0
  const riskLabel = riskScore >= 60 ? 'High Risk' : riskScore >= 30 ? 'Medium Risk' : 'Low Risk'
  const riskColor = riskScore >= 60 ? 'text-red-600' : riskScore >= 30 ? 'text-amber-600' : 'text-emerald-600'
  const riskStroke = riskScore >= 60 ? '#ef4444' : riskScore >= 30 ? '#f59e0b' : '#10b981'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Analysis Results</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {total} clause{total !== 1 ? 's' : ''} reviewed
                {result.jurisdiction?.jurisdiction && (
                  <> · <span className="text-indigo-600 font-medium">{result.jurisdiction.jurisdiction}</span></>
                )}
              </p>
            </div>
          </div>

          {total > 0 && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className={`text-base font-black ${riskColor}`}>{riskLabel}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Risk Assessment</div>
              </div>
              <div className="relative h-11 w-11 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke={riskStroke} strokeWidth="3.5"
                    strokeDasharray={`${(riskScore / 100) * 87.96} 87.96`} strokeLinecap="round" />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-black ${riskColor}`}>
                  {riskScore}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Stat pills */}
        {total > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <StatPill color="emerald" label="Match" count={matches} />
            <StatPill color="red" label="Violation" count={violations} />
            <StatPill color="amber" label="Partial" count={partial} />
            <StatPill color="blue" label="Not Found" count={notFound} />
            {conflicts.length > 0 && <StatPill color="orange" label="Conflicts" count={conflicts.length} />}
          </div>
        )}

        {/* Progress bar */}
        {total > 0 && (
          <div className="mt-4">
            <div className="flex rounded-full overflow-hidden h-2 bg-slate-100">
              {matches > 0 && <div className="bg-emerald-500" style={{ width: `${(matches / total) * 100}%` }} />}
              {partial > 0 && <div className="bg-amber-400" style={{ width: `${(partial / total) * 100}%` }} />}
              {notFound > 0 && <div className="bg-blue-400" style={{ width: `${(notFound / total) * 100}%` }} />}
              {violations > 0 && <div className="bg-red-500" style={{ width: `${(violations / total) * 100}%` }} />}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-slate-400">Compliance overview</span>
              <span className="text-[10px] font-semibold text-slate-500">{Math.round((matches / total) * 100)}% matched</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Summary ── */}
      {result.summary_md_base64
        ? <SummaryPanel base64={result.summary_md_base64} />
        : <EmptyState message="No summary available for this analysis." />
      }

    </div>
  )
}

// ─── Summary panel ────────────────────────────────────────────────────────────

function SummaryPanel({ base64 }: { base64: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(500)
  const [loaded, setLoaded] = useState(false)
  // Decode after first paint so it doesn't block the tab switch render
  const [raw, setRaw] = useState<string | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setRaw(decodeBase64(base64))
    })
    return () => cancelAnimationFrame(id)
  }, [base64])

  const handleLoad = () => {
    try {
      const body = iframeRef.current?.contentDocument?.body
      if (body) {
        setTimeout(() => {
          if (body.scrollHeight > 0) setHeight(body.scrollHeight + 40)
          setLoaded(true)
        }, 80)
      } else {
        setLoaded(true)
      }
    } catch {
      setLoaded(true)
    }
  }

  if (raw === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 bg-white" style={{ minHeight: 300 }}>
        <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <span className="text-xs text-slate-400">Preparing summary…</span>
      </div>
    )
  }

  if (!raw) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-400">
        Summary report could not be decoded.
      </div>
    )
  }

  return (
    <div className="relative w-full">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white" style={{ minHeight: 300 }}>
          <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span className="text-xs text-slate-400">Loading summary…</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={raw}
        onLoad={handleLoad}
        className="w-full border-0 block"
        style={{ height: `${height}px`, opacity: loaded ? 1 : 0, transition: 'opacity 0.2s ease' }}
        title="Analysis Summary"
      />
    </div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  color, label, count,
}: {
  color: 'emerald' | 'red' | 'amber' | 'blue' | 'orange'
  label: string
  count: number
}) {
  const styles = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  const dotStyles = {
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
  }
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${styles[color]}`}>
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotStyles[color]}`} />
      <span className="font-black text-sm">{count}</span>
      <span className="opacity-80">{label}</span>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message, icon }: { message: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      {icon === 'check' ? (
        <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
          <svg className="text-emerald-500" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      ) : (
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <svg className="text-slate-300" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
      )}
      <p className="text-sm text-slate-400 max-w-[240px] leading-relaxed">{message}</p>
    </div>
  )
}

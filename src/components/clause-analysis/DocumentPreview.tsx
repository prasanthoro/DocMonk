import { useRef, useState } from 'react'
import EditorComponent from '../editor/EditorComponent'

interface Props {
  editorData: any
  onChange: (data: any) => void
  documentTitle: string
  onTitleChange: (t: string) => void
  isReportMode?: boolean
  decisionStats?: { total: number; decided: number }
  reportHtml?: string | null
}

export default function DocumentPreview({
  editorData, onChange, documentTitle, onTitleChange,
  isReportMode = false, decisionStats, reportHtml,
}: Props) {
  const blockCount = editorData?.blocks?.length ?? 0
  const hasDiffBlocks = !!(editorData?.blocks?.some((b: any) => b.type === 'diffBlock'))
  const diffCount = editorData?.blocks?.filter((b: any) => b.type === 'diffBlock').length ?? 0
  const total = decisionStats?.total ?? 0
  const decided = decisionStats?.decided ?? 0
  const pending = total - decided
  const allDone = total > 0 && decided === total

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(600)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  const handleIframeLoad = () => {
    try {
      const body = iframeRef.current?.contentDocument?.body
      if (body) {
        setTimeout(() => {
          if (body.scrollHeight > 0) setIframeHeight(body.scrollHeight + 40)
          setIframeLoaded(true)
        }, 80)
      } else {
        setIframeLoaded(true)
      }
    } catch {
      setIframeLoaded(true)
    }
  }

  // When API returns report HTML but EditorJS diff parsing produced 0 blocks, show iframe
  const showIframe = isReportMode && !!reportHtml && !hasDiffBlocks

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">

      {/* ── Header ── */}
      <div className="border-b border-slate-100 px-5 py-3 flex items-center gap-3 bg-white flex-shrink-0">
        <svg className="text-slate-300 flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <input
          type="text"
          placeholder={isReportMode ? 'Analysis Report' : 'Document title (optional)…'}
          value={documentTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          className="flex-1 text-sm font-semibold text-slate-900 placeholder-slate-400 border-none outline-none bg-transparent"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* DiffBlock review badge */}
          {isReportMode && hasDiffBlocks && total > 0 && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border ${allDone
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${allDone ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {allDone ? 'All reviewed' : `${pending} pending`}
            </span>
          )}
          {/* Iframe diff report badge */}
          {showIframe && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              Diff Report
            </span>
          )}
          {!isReportMode && blockCount > 0 && (
            <span className="text-[11px] text-slate-400 tabular-nums">{blockCount} blocks</span>
          )}
        </div>
      </div>

      {/* ── Diff progress bar (EditorJS diffBlock mode only) ── */}
      {isReportMode && hasDiffBlocks && total > 0 && (
        <div className={`px-5 py-3 border-b flex-shrink-0 ${allDone
          ? 'bg-emerald-50 border-emerald-100'
          : 'bg-gradient-to-r from-indigo-50/80 to-violet-50/60 border-indigo-100'
          }`}>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold ${allDone ? 'text-emerald-800' : 'text-indigo-800'}`}>
                  {allDone
                    ? '✓ All changes reviewed — ready to export'
                    : 'Review each change — click Accept or Reject'
                  }
                </p>
                <span className="text-[11px] font-bold text-slate-500 tabular-nums ml-3">{decided}/{total}</span>
              </div>
              <div className="h-1.5 bg-white/80 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${total > 0 ? (decided / total) * 100 : 0}%` }}
                />
              </div>
            </div>
            {diffCount > 0 && !allDone && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 bg-white border border-amber-200 text-amber-700 text-[11px] font-bold rounded-full px-2.5 py-1">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                {diffCount} diff{diffCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state hint (edit mode, no content) ── */}
      {!isReportMode && !editorData?.blocks?.length && (
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          <p className="text-[11px] text-slate-400 text-center">
            Upload a document to preview it here, or start typing below.
          </p>
        </div>
      )}

      {/* ── Content: iframe (diff report fallback) OR EditorJS ── */}
      {showIframe ? (
        <div className="relative w-full">
          {!iframeLoaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white rounded-b-2xl" style={{ minHeight: 300 }}>
              <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-xs text-slate-400">Loading diff report…</span>
            </div>
          )}
          <iframe
            ref={iframeRef}
            srcDoc={reportHtml!}
            onLoad={handleIframeLoad}
            className="w-full border-0 rounded-b-2xl block"
            style={{ height: `${iframeHeight}px`, opacity: iframeLoaded ? 1 : 0, transition: 'opacity 0.2s ease' }}
            title="Diff Report"
          />
        </div>
      ) : (
        <div className="px-4 py-4" style={{ minHeight: isReportMode ? 500 : 420 }}>
          <EditorComponent
            data={editorData}
            onChange={onChange}
            editorId="docmonk-document-preview"
            minHeight={isReportMode ? 480 : 400}
            placeholder="Start typing your contract, or upload a document above…"
          />
        </div>
      )}
    </div>
  )
}

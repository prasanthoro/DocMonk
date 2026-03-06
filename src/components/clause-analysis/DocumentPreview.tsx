import EditorComponent from '../editor/EditorComponent'

interface Props {
  editorData: any
  onChange: (data: any) => void
  documentTitle: string
  onTitleChange: (t: string) => void
  isReportMode?: boolean
}

export default function DocumentPreview({ editorData, onChange, documentTitle, onTitleChange, isReportMode = false }: Props) {
  const blockCount = editorData?.blocks?.length ?? 0
  const diffCount = editorData?.blocks?.filter((b: any) => b.type === 'diffBlock').length ?? 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="border-b border-slate-100 px-5 py-3.5 flex items-center gap-3">
        <svg className="text-slate-400 flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <input
          type="text"
          placeholder={isReportMode ? 'Analysis Report' : 'Document title (optional)…'}
          value={documentTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          className="flex-1 text-base font-semibold text-slate-900 placeholder-slate-400 border-none outline-none bg-transparent"
        />
        <div className="flex items-center gap-2">
          {isReportMode && diffCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">
              {diffCount} change{diffCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-slate-400 tabular-nums">{blockCount} blocks</span>
        </div>
      </div>

      {/* Banner */}
      {isReportMode ? (
        <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-start gap-2">
          <svg className="text-indigo-500 flex-shrink-0 mt-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-xs text-indigo-700 leading-relaxed">
            Analysis complete. Review each change below — <strong>Accept</strong> to apply the updated clause, <strong>Reject</strong> to keep the original.
          </p>
        </div>
      ) : (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-2">

        </div>
      )}

      {/* Editor */}
      <div className="px-5 py-4" style={{ minHeight: 480 }}>
        <EditorComponent
          data={editorData}
          onChange={onChange}
          editorId="docmonk-document-preview"
          minHeight={440}
        />
      </div>
    </div>
  )
}

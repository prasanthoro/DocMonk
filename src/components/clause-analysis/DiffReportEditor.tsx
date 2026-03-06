import { useEffect, useRef, useState, useCallback } from 'react'
import EditorJS from '@editorjs/editorjs'
import Paragraph from '@editorjs/paragraph'
import DiffBlockTool from '../editor/DiffBlockTool'
import { parseDiffHtmlToBlocks } from '../../utils/parseDiffHtmlToBlocks'
import { markdownToHtml } from '../../utils/markdownToHtml'
import { decodeBase64 } from '../../utils/base64'

interface Props {
  reportBase64: string | undefined
  summaryBase64?: string | undefined
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

// ─── Resolved modal ───────────────────────────────────────────────────────────

function ResolvedModal({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Resolved Document</h3>
            <p className="text-xs text-slate-400 mt-0.5">All your approve/reject decisions applied</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
            >
              <CopyIcon /> {copied ? 'Copied!' : 'Copy text'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <XIcon />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          <pre className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
            {text}
          </pre>
        </div>
      </div>
    </div>
  )
}

// ─── Summary panel ────────────────────────────────────────────────────────────

function SummaryPanel({ base64 }: { base64: string | undefined }) {
  if (!base64) return null
  const raw = decodeBase64(base64)
  if (!raw) return null
  const html = markdownToHtml(raw)
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-500" />
        <h3 className="text-sm font-bold text-slate-800">Analysis Summary</h3>
      </div>
      <div
        className="px-5 py-4"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiffReportEditor({ reportBase64, summaryBase64 }: Props) {
  const holderId = 'diff-report-editor'
  const editorRef = useRef<EditorJS | null>(null)
  const mountedRef = useRef(false)
  const [stats, setStats] = useState({ total: 0, decided: 0 })
  const [showResolved, setShowResolved] = useState(false)
  const [resolvedText, setResolvedText] = useState('')
  const [isReady, setIsReady] = useState(false)

  // Called by each DiffBlockTool on any decision
  const onDecisionChange = useCallback(async () => {
    if (!editorRef.current || !mountedRef.current) return
    try {
      const saved = await editorRef.current.save()
      const diffBlocks = saved.blocks.filter((b) => b.type === 'diffBlock')
      const decided = diffBlocks.filter((b) => (b.data as any).decision != null).length
      if (mountedRef.current) setStats({ total: diffBlocks.length, decided })
    } catch { /* ignore */ }
  }, [])

  // ── Init editor ────────────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true

    if (!reportBase64) return

    const html = decodeBase64(reportBase64)
    if (!html) return

    const blocks = parseDiffHtmlToBlocks(html)
    const diffCount = blocks.filter((b) => b.type === 'diffBlock').length
    setStats({ total: diffCount, decided: 0 })

    const holderEl = document.getElementById(holderId)
    if (holderEl) holderEl.innerHTML = ''

    const editor = new EditorJS({
      holder: holderId,
      tools: {
        paragraph: {
          class: Paragraph as any,
          config: { preserveBlank: true },
        },
        diffBlock: {
          class: DiffBlockTool as any,
          config: { onDecisionChange },
        },
      },
      data: {
        time: Date.now(),
        blocks,
        version: '2.31.4',
      },
      readOnly: false,  // must be false so DiffBlock buttons are clickable
      minHeight: 100,
      onReady: () => {
        if (mountedRef.current) setIsReady(true)
      },
    })

    editorRef.current = editor

    return () => {
      mountedRef.current = false
      try { editor.destroy?.() } catch { /* ignore */ }
      editorRef.current = null
      setIsReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportBase64])

  // ── Bulk actions ───────────────────────────────────────────────────────────

  const bulkDecide = useCallback(async (decision: 'approved' | 'rejected') => {
    if (!editorRef.current) return
    try {
      const saved = await editorRef.current.save()
      const updatedBlocks = saved.blocks.map((b) =>
        b.type === 'diffBlock'
          ? { ...b, data: { ...(b.data as any), decision } }
          : b,
      )
      await editorRef.current.clear()
      await editorRef.current.render({
        time: Date.now(),
        blocks: updatedBlocks,
        version: '2.31.4',
      } as any)
      const diffCount = updatedBlocks.filter((b) => b.type === 'diffBlock').length
      setStats({ total: diffCount, decided: diffCount })
    } catch { /* ignore */ }
  }, [])

  // ── View resolved ──────────────────────────────────────────────────────────

  const viewResolved = useCallback(async () => {
    if (!editorRef.current) return
    try {
      const saved = await editorRef.current.save()
      const lines: string[] = []
      for (const block of saved.blocks) {
        if (block.type === 'paragraph') {
          const text = (block.data as any).text?.trim()
          if (text) lines.push(text)
        } else if (block.type === 'diffBlock') {
          const d = block.data as any
          if (d.diffType === 'new') {
            // new clause: only add if approved (or undecided → include it)
            if (d.decision !== 'rejected' && d.addedText) lines.push(d.addedText)
          } else {
            // modified / partial
            if (d.decision === 'approved' && d.addedText) lines.push(d.addedText)
            else if (d.decision === 'rejected' && d.deletedText) lines.push(d.deletedText)
            else if (!d.decision && d.addedText) lines.push(d.addedText) // undecided → use new
          }
        }
      }
      setResolvedText(lines.join('\n\n'))
      setShowResolved(true)
    } catch { /* ignore */ }
  }, [])

  // ── Stats ──────────────────────────────────────────────────────────────────

  const pct = stats.total === 0 ? 0 : Math.round((stats.decided / stats.total) * 100)
  const allDone = stats.total > 0 && stats.decided === stats.total

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!reportBase64) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-slate-400">No report available.</p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Toolbar ── */}
      {stats.total > 0 && (
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur pb-3 mb-2">
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-2.5">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">
              {stats.decided}/{stats.total} reviewed
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">
              {stats.total} change{stats.total !== 1 ? 's' : ''} to review
            </span>
            <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
              <button
                onClick={() => bulkDecide('approved')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
              >
                <CheckIcon /> Accept all
              </button>
              <button
                onClick={() => bulkDecide('rejected')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                <XIcon /> Reject all
              </button>
              <button
                onClick={viewResolved}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition ${
                  allDone
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-sm'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
                disabled={!allDone}
                title={allDone ? 'View resolved document' : 'Review all changes first'}
              >
                View resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EditorJS container ── */}
      <div
        id={holderId}
        className="diff-report-editor-holder"
        style={{ minHeight: 200 }}
      />

      {/* ── All-done banner ── */}
      {allDone && isReady && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
            <CheckIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">All changes reviewed!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Click "View resolved" to see and copy the final document text.
            </p>
          </div>
          <button
            onClick={viewResolved}
            className="flex-shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
          >
            View resolved doc
          </button>
        </div>
      )}

      {/* ── Summary section (below editor) ── */}
      <SummaryPanel base64={summaryBase64} />

      {/* ── Resolved modal ── */}
      {showResolved && (
        <ResolvedModal text={resolvedText} onClose={() => setShowResolved(false)} />
      )}
    </div>
  )
}

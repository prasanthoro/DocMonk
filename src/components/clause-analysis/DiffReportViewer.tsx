import { useState, useMemo } from 'react'
import { decodeBase64 } from '../../utils/base64'

// ─── Types ────────────────────────────────────────────────────────────────────

type DiffType = 'unchanged' | 'modified' | 'partial' | 'new'
type Decision = 'approved' | 'rejected' | null

interface DiffGroup {
  id: number
  type: DiffType
  reason?: string
  deletedText?: string
  addedText?: string
  normalText?: string
}

// ─── HTML Parser ──────────────────────────────────────────────────────────────

function parseDiffHtml(html: string): DiffGroup[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const groupEls = doc.querySelectorAll('.diff-group')

  return Array.from(groupEls).map((group, id) => {
    const type = (group.getAttribute('data-type') || 'unchanged') as DiffType

    const reason = group.querySelector('.reason-tooltip')?.textContent?.trim()

    const deletedEl = group.querySelector('.diff-line.deleted .line-content')
    const oldTextEl = deletedEl?.querySelector('.old-text')
    const deletedText = (oldTextEl?.textContent || deletedEl?.textContent || '').trim()

    const addedEl = group.querySelector('.diff-line.added .line-content, .diff-line.new-clause .line-content')
    const addedText = addedEl?.textContent?.trim() || ''

    const normalEl = group.querySelector('.diff-line.normal .line-content')
    const normalText = normalEl?.textContent?.trim() || ''

    return { id, type, reason, deletedText, addedText, normalText }
  })
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
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

// ─── Diff Row ─────────────────────────────────────────────────────────────────

interface DiffRowProps {
  group: DiffGroup
  decision: Decision
  onDecide: (id: number, d: Decision) => void
}

function DiffRow({ group, decision, onDecide }: DiffRowProps) {
  const [showReason, setShowReason] = useState(false)
  const isChanged = group.type !== 'unchanged'

  // ── Unchanged: just show context text ────────────────────────────────────
  if (!isChanged) {
    if (!group.normalText) return null
    return (
      <div className="diff-row-unchanged px-4 py-1.5 text-slate-500 text-sm leading-relaxed border-l-2 border-transparent">
        {group.normalText}
      </div>
    )
  }

  // ── Changed: modified / partial / new ─────────────────────────────────────
  const typeColors = {
    modified: { label: 'Violation', labelCls: 'bg-red-100 text-red-700', border: 'border-red-200' },
    partial: { label: 'Partial', labelCls: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
    new: { label: 'New Clause', labelCls: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
  }
  const tc = typeColors[group.type as 'modified' | 'partial' | 'new']

  const isApproved = decision === 'approved'
  const isRejected = decision === 'rejected'

  return (
    <div className={`diff-row-changed rounded-xl border my-2 overflow-hidden ${tc.border} ${isApproved ? 'ring-2 ring-emerald-400/60' : isRejected ? 'ring-2 ring-slate-300/60 opacity-70' : ''}`}>
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
        <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${tc.labelCls}`}>
          {tc.label}
        </span>

        {group.reason && (
          <button
            onClick={() => setShowReason((v) => !v)}
            className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition"
          >
            <InfoIcon />
            {showReason ? 'Hide reason' : 'Why?'}
          </button>
        )}

        {/* Decision badge */}
        {decision && (
          <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 flex items-center gap-1 ${isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
            {isApproved ? <><CheckIcon /> Approved</> : <><XIcon /> Rejected</>}
          </span>
        )}
      </div>

      {/* Reason tooltip */}
      {showReason && group.reason && (
        <div className="px-4 py-2.5 bg-slate-800 text-slate-200 text-xs leading-relaxed">
          {group.reason}
        </div>
      )}

      {/* Diff content */}
      <div className="divide-y divide-slate-100">
        {/* Deleted / old line */}
        {group.deletedText && (
          <div className="flex items-start gap-2.5 px-4 py-2.5 bg-red-50">
            <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-red-200 text-red-700 text-xs font-bold flex items-center justify-center">−</span>
            <p className="text-sm text-red-800 leading-relaxed line-through opacity-75 flex-1">
              {group.deletedText}
            </p>
          </div>
        )}

        {/* Added / new line */}
        {group.addedText && (
          <div className={`flex items-start gap-2.5 px-4 py-2.5 ${group.type === 'new' ? 'bg-blue-50' : 'bg-emerald-50'}`}>
            <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${group.type === 'new' ? 'bg-blue-200 text-blue-700' : 'bg-emerald-200 text-emerald-700'}`}>+</span>
            <p className={`text-sm leading-relaxed flex-1 ${group.type === 'new' ? 'text-blue-900' : 'text-emerald-900'}`}>
              {group.addedText}
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!decision ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-t border-slate-100">
          <span className="text-xs text-slate-400 mr-auto">Apply this change?</span>
          <button
            onClick={() => onDecide(group.id, 'approved')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 active:scale-95 transition"
          >
            <CheckIcon /> Accept
          </button>
          <button
            onClick={() => onDecide(group.id, 'rejected')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-300 active:scale-95 transition"
          >
            <XIcon /> Reject
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2 bg-white border-t border-slate-100">
          <span className="text-xs text-slate-400 flex-1">
            {isApproved ? 'Using updated text.' : 'Keeping original text.'}
          </span>
          <button
            onClick={() => onDecide(group.id, null)}
            className="text-xs text-slate-400 hover:text-slate-600 transition underline underline-offset-2"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Resolved Preview ─────────────────────────────────────────────────────────

interface ResolvedPreviewProps {
  groups: DiffGroup[]
  decisions: Record<number, Decision>
  onClose: () => void
}

function ResolvedPreview({ groups, decisions, onClose }: ResolvedPreviewProps) {
  const lines = groups.map((g) => {
    if (g.type === 'unchanged') return g.normalText || ''
    const d = decisions[g.id]
    if (g.type === 'new') return d === 'approved' ? g.addedText || '' : ''
    // modified / partial
    if (d === 'approved') return g.addedText || ''
    if (d === 'rejected') return g.deletedText || ''
    return g.addedText || '' // default to new if undecided
  }).filter(Boolean)

  const text = lines.join('\n\n')

  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Resolved Document</h3>
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

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 whitespace-nowrap">
        {done}/{total} reviewed
      </span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  base64: string | undefined
}

export default function DiffReportViewer({ base64 }: Props) {
  const [decisions, setDecisions] = useState<Record<number, Decision>>({})
  const [showResolved, setShowResolved] = useState(false)

  const groups = useMemo<DiffGroup[]>(() => {
    if (!base64) return []
    const html = decodeBase64(base64)
    if (!html) return []
    return parseDiffHtml(html)
  }, [base64])

  const changedGroups = useMemo(() => groups.filter((g) => g.type !== 'unchanged'), [groups])
  const decidedCount = changedGroups.filter((g) => decisions[g.id] != null).length
  const allDone = changedGroups.length > 0 && decidedCount === changedGroups.length

  const decide = (id: number, d: Decision) => {
    setDecisions((prev) => ({ ...prev, [id]: d }))
  }

  const acceptAll = () => {
    const next: Record<number, Decision> = { ...decisions }
    changedGroups.forEach((g) => { next[g.id] = 'approved' })
    setDecisions(next)
  }

  const rejectAll = () => {
    const next: Record<number, Decision> = { ...decisions }
    changedGroups.forEach((g) => { next[g.id] = 'rejected' })
    setDecisions(next)
  }

  if (!base64 || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-slate-400">No report available.</p>
      </div>
    )
  }

  return (
    <div className="diff-report-viewer">
      {/* ── Toolbar ── */}
      {changedGroups.length > 0 && (
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-1 pb-3 mb-3">
          <ProgressBar done={decidedCount} total={changedGroups.length} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">
              {changedGroups.length} change{changedGroups.length !== 1 ? 's' : ''} to review
            </span>
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={acceptAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
              >
                <CheckIcon /> Accept all
              </button>
              <button
                onClick={rejectAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                <XIcon /> Reject all
              </button>
              {allDone && (
                <button
                  onClick={() => setShowResolved(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                >
                  View resolved
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Diff rows ── */}
      <div className="space-y-0.5">
        {groups.map((group) => (
          <DiffRow
            key={group.id}
            group={group}
            decision={decisions[group.id] ?? null}
            onDecide={decide}
          />
        ))}
      </div>

      {/* ── All done banner ── */}
      {allDone && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <CheckIcon />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">All changes reviewed!</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {changedGroups.filter((g) => decisions[g.id] === 'approved').length} accepted,{' '}
              {changedGroups.filter((g) => decisions[g.id] === 'rejected').length} rejected
            </p>
          </div>
          <button
            onClick={() => setShowResolved(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
          >
            View resolved doc
          </button>
        </div>
      )}

      {/* ── Resolved preview modal ── */}
      {showResolved && (
        <ResolvedPreview
          groups={groups}
          decisions={decisions}
          onClose={() => setShowResolved(false)}
        />
      )}
    </div>
  )
}

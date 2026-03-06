/**
 * DiffBlockTool — EditorJS block for diff review.
 * Renders a side-by-side deleted/added view with Accept/Reject buttons.
 * No external dependencies.
 */

export type DiffType = 'modified' | 'partial' | 'new'
export type DiffDecision = 'approved' | 'rejected' | null

export interface DiffBlockData {
  diffType: DiffType
  deletedText: string
  addedText: string
  reason?: string
  decision: DiffDecision
}

interface DiffBlockConfig {
  onDecisionChange?: () => void
}

// ─── Tiny SVGs ────────────────────────────────────────────────────────────────

const SVG_CHECK = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
const SVG_X = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
const SVG_INFO = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<DiffType, { label: string; badgeCls: string; border: string; borderActive: string }> = {
  modified: { label: 'Violation',  badgeCls: 'background:#fee2e2;color:#b91c1c;', border: '#fca5a5', borderActive: '#ef4444' },
  partial:  { label: 'Partial',    badgeCls: 'background:#fef3c7;color:#92400e;', border: '#fcd34d', borderActive: '#f59e0b' },
  new:      { label: 'New Clause', badgeCls: 'background:#dbeafe;color:#1e40af;', border: '#93c5fd', borderActive: '#3b82f6' },
}

// ─── Tool class ───────────────────────────────────────────────────────────────

export default class DiffBlockTool {
  static get toolbox() {
    return { title: 'Diff', icon: SVG_CHECK }
  }

  static get isReadOnlySupported() {
    return true
  }

  static get sanitize() {
    return {
      diffType: {},
      deletedText: {},
      addedText: {},
      reason: {},
      decision: {},
    }
  }

  private data: DiffBlockData
  private wrapper: HTMLElement
  private onDecisionChange?: () => void
  private reasonVisible = false

  constructor({ data, config }: { data: any; config: DiffBlockConfig }) {
    this.data = {
      diffType: data.diffType || 'modified',
      deletedText: data.deletedText || '',
      addedText: data.addedText || '',
      reason: data.reason || '',
      decision: data.decision || null,
    }
    this.onDecisionChange = (config as DiffBlockConfig)?.onDecisionChange
    this.wrapper = document.createElement('div')
  }

  render(): HTMLElement {
    this._build()
    return this.wrapper
  }

  save(): DiffBlockData {
    return { ...this.data }
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  private _build() {
    const { diffType, decision } = this.data
    const tc = TYPE_CONFIG[diffType]

    // Outer wrapper
    const borderColor = decision === 'approved' ? '#10b981'
      : decision === 'rejected'  ? '#cbd5e1'
      : tc.border

    const boxShadow = decision === 'approved'
      ? 'box-shadow:0 0 0 2.5px rgba(16,185,129,0.35);'
      : ''

    const opacity = decision === 'rejected' ? 'opacity:0.72;' : ''

    this.wrapper.innerHTML = ''
    this.wrapper.setAttribute(
      'style',
      `margin:6px 0;border-radius:12px;overflow:hidden;border:1.5px solid ${borderColor};${boxShadow}${opacity}transition:all 200ms ease;`,
    )

    this.wrapper.appendChild(this._header(tc))
    const reasonEl = this._reasonRow()
    this.wrapper.appendChild(reasonEl)
    this.wrapper.appendChild(this._diffRows())
    this.wrapper.appendChild(this._footer())

    // Wire up Why? toggle
    const whyBtn = this.wrapper.querySelector<HTMLElement>('.dbw-btn')
    if (whyBtn) {
      whyBtn.onclick = () => {
        this.reasonVisible = !this.reasonVisible
        reasonEl.style.display = this.reasonVisible ? 'block' : 'none'
        whyBtn.style.color = this.reasonVisible ? '#6366f1' : '#94a3b8'
      }
    }

    // Wire accept/reject/undo
    const acceptBtn = this.wrapper.querySelector<HTMLElement>('.dbw-accept')
    const rejectBtn = this.wrapper.querySelector<HTMLElement>('.dbw-reject')
    const undoBtn   = this.wrapper.querySelector<HTMLElement>('.dbw-undo')

    if (acceptBtn) acceptBtn.onclick = () => this._decide('approved')
    if (rejectBtn) rejectBtn.onclick = () => this._decide('rejected')
    if (undoBtn)   undoBtn.onclick   = () => this._decide(null)
  }

  private _header(tc: typeof TYPE_CONFIG[DiffType]): HTMLElement {
    const header = document.createElement('div')
    header.setAttribute('style', 'display:flex;align-items:center;gap:8px;padding:8px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;')

    // Type badge
    const badge = el('span', `${tc.badgeCls}font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-radius:9999px;padding:2px 8px;`)
    badge.textContent = tc.label
    header.appendChild(badge)

    // Spacer
    header.appendChild(el('div', 'flex:1;'))

    // Decision badge (after decision)
    if (this.data.decision) {
      const db = el('span', `font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-radius:9999px;padding:2px 8px;display:inline-flex;align-items:center;gap:4px;${this.data.decision === 'approved' ? 'background:#d1fae5;color:#065f46;' : 'background:#e2e8f0;color:#475569;'}`)
      db.innerHTML = this.data.decision === 'approved'
        ? `${SVG_CHECK} Approved`
        : `${SVG_X} Rejected`
      header.appendChild(db)
    }

    // Why? button
    if (this.data.reason) {
      const btn = el('button', 'dbw-btn;background:none;border:none;cursor:pointer;font-size:11px;color:#94a3b8;display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:4px;')
      btn.innerHTML = `${SVG_INFO} Why?`
      btn.setAttribute('style', 'background:none;border:none;cursor:pointer;font-size:11px;color:#94a3b8;display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:4px;')
      btn.className = 'dbw-btn'
      header.appendChild(btn)
    }

    return header
  }

  private _reasonRow(): HTMLElement {
    const row = el('div', '')
    row.setAttribute('style', `display:none;padding:10px 14px;background:#1e293b;color:#94a3b8;font-size:12px;line-height:1.6;`)
    row.textContent = this.data.reason || ''
    return row
  }

  private _diffRows(): HTMLElement {
    const { diffType, deletedText, addedText, decision } = this.data
    const container = document.createElement('div')

    // Deleted row — shown when: undecided OR rejected
    if (deletedText && decision !== 'approved') {
      const row = el('div', '')
      row.setAttribute('style', 'display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:#fef2f2;border-top:1px solid #fecaca;')

      const badge = el('span', '')
      badge.setAttribute('style', 'flex-shrink:0;width:20px;height:20px;border-radius:50%;background:#fecaca;color:#b91c1c;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:2px;')
      badge.textContent = '−'

      const text = el('p', '')
      text.setAttribute('style', `margin:0;flex:1;font-size:13px;line-height:1.65;${decision === 'rejected' ? 'color:#374151;' : 'color:#991b1b;text-decoration:line-through;opacity:0.75;'}`)
      text.textContent = deletedText

      row.appendChild(badge)
      row.appendChild(text)
      container.appendChild(row)
    }

    // Added row — shown when: undecided OR approved
    if (addedText && decision !== 'rejected') {
      const isNew = diffType === 'new'
      const row = el('div', '')
      row.setAttribute('style', `display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:${isNew ? '#eff6ff' : '#f0fdf4'};border-top:1px solid ${isNew ? '#bfdbfe' : '#bbf7d0'};`)

      const badge = el('span', '')
      badge.setAttribute('style', `flex-shrink:0;width:20px;height:20px;border-radius:50%;background:${isNew ? '#bfdbfe' : '#bbf7d0'};color:${isNew ? '#1d4ed8' : '#15803d'};font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:2px;`)
      badge.textContent = '+'

      const text = el('p', '')
      text.setAttribute('style', `margin:0;flex:1;font-size:13px;line-height:1.65;color:${isNew ? '#1e3a8a' : '#14532d'};`)
      text.textContent = addedText

      row.appendChild(badge)
      row.appendChild(text)
      container.appendChild(row)
    }

    // New + rejected: show "not adding" placeholder
    if (diffType === 'new' && decision === 'rejected') {
      const ph = el('div', '')
      ph.setAttribute('style', 'padding:8px 14px;background:#f8fafc;font-size:12px;color:#94a3b8;font-style:italic;border-top:1px solid #e2e8f0;')
      ph.textContent = 'This clause will not be added.'
      container.appendChild(ph)
    }

    return container
  }

  private _footer(): HTMLElement {
    const footer = el('div', '')
    footer.setAttribute('style', 'display:flex;align-items:center;gap:8px;padding:8px 14px;background:#ffffff;border-top:1px solid #f1f5f9;')

    if (!this.data.decision) {
      const label = el('span', '')
      label.setAttribute('style', 'font-size:11.5px;color:#94a3b8;flex:1;')
      label.textContent = 'Apply this change?'
      footer.appendChild(label)

      const acceptBtn = el('button', '')
      acceptBtn.className = 'dbw-accept'
      acceptBtn.setAttribute('style', 'display:inline-flex;align-items:center;gap:5px;background:#10b981;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;')
      acceptBtn.innerHTML = `${SVG_CHECK} Accept`

      const rejectBtn = el('button', '')
      rejectBtn.className = 'dbw-reject'
      rejectBtn.setAttribute('style', 'display:inline-flex;align-items:center;gap:5px;background:#e2e8f0;color:#475569;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;')
      rejectBtn.innerHTML = `${SVG_X} Reject`

      footer.appendChild(acceptBtn)
      footer.appendChild(rejectBtn)
    } else {
      const msg = el('span', '')
      msg.setAttribute('style', 'font-size:12px;color:#94a3b8;flex:1;')
      msg.textContent = this.data.decision === 'approved'
        ? 'Using updated text.'
        : this.data.diffType === 'new' ? 'Not adding this clause.' : 'Keeping original text.'
      footer.appendChild(msg)

      const undoBtn = el('button', '')
      undoBtn.className = 'dbw-undo'
      undoBtn.setAttribute('style', 'background:none;border:none;cursor:pointer;font-size:12px;color:#94a3b8;text-decoration:underline;text-underline-offset:2px;')
      undoBtn.textContent = 'Undo'
      footer.appendChild(undoBtn)
    }

    return footer
  }

  private _decide(decision: DiffDecision) {
    this.data.decision = decision
    this._build()
    this.onDecisionChange?.()
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function el(tag: string, _cls: string) {
  return document.createElement(tag)
}

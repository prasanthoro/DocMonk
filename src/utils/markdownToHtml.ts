/**
 * Markdown → styled HTML converter for clause-analysis API summaries.
 * Handles: ## / ### headings, **bold**, *italic*, `code`,
 *          | tables |, --- rules, - / * / numbered lists,
 *          blockquotes, paragraphs, and special status badges.
 */
export function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inTable = false
  let tableHasHeader = false
  let inList = false
  let inOrderedList = false
  let inBlockquote = false

  const closeTable = () => {
    if (!inTable) return
    out.push('</tbody></table></div>')
    inTable = false
    tableHasHeader = false
  }

  const closeList = () => {
    if (inList) { out.push('</ul>'); inList = false }
    if (inOrderedList) { out.push('</ol>'); inOrderedList = false }
  }

  const closeBlockquote = () => {
    if (!inBlockquote) return
    out.push('</blockquote>')
    inBlockquote = false
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()

    // Horizontal rule
    if (/^---+$/.test(line)) {
      closeTable(); closeList(); closeBlockquote()
      out.push('<hr style="border:none;border-top:2px solid #e2e8f0;margin:20px 0;" />')
      continue
    }

    // H1
    const h1 = line.match(/^# (.+)$/)
    if (h1) {
      closeTable(); closeList(); closeBlockquote()
      out.push(`<h1 style="font-size:17px;font-weight:800;color:#0f172a;margin:24px 0 10px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;letter-spacing:-0.02em;">${inline(h1[1])}</h1>`)
      continue
    }

    // H2
    const h2 = line.match(/^## (.+)$/)
    if (h2) {
      closeTable(); closeList(); closeBlockquote()
      out.push(`<h2 style="font-size:14px;font-weight:800;color:#1e293b;margin:22px 0 8px;display:flex;align-items:center;gap:8px;"><span style="display:inline-block;width:3px;height:16px;background:#6366f1;border-radius:2px;flex-shrink:0;margin-top:1px;"></span>${inline(h2[1])}</h2>`)
      continue
    }

    // H3
    const h3 = line.match(/^### (.+)$/)
    if (h3) {
      closeTable(); closeList(); closeBlockquote()
      out.push(`<h3 style="font-size:12.5px;font-weight:700;color:#334155;margin:14px 0 5px;text-transform:uppercase;letter-spacing:0.04em;">${inline(h3[1])}</h3>`)
      continue
    }

    // Blockquote
    const bqM = line.match(/^> (.+)$/)
    if (bqM) {
      closeTable(); closeList()
      if (!inBlockquote) {
        out.push('<blockquote style="border-left:3px solid #6366f1;margin:12px 0;padding:10px 14px;background:#f5f3ff;border-radius:0 10px 10px 0;">')
        inBlockquote = true
      }
      out.push(`<p style="font-size:12.5px;color:#4f46e5;margin:2px 0;font-style:italic;line-height:1.65;">${inline(bqM[1])}</p>`)
      continue
    }
    if (inBlockquote && !line.startsWith('>')) closeBlockquote()

    // Table separator row
    if (/^\|[\s:|-]+\|/.test(line)) {
      tableHasHeader = true
      continue
    }

    // Table row
    if (line.startsWith('|')) {
      if (!inTable) {
        out.push('<div style="overflow-x:auto;margin:12px 0;border-radius:10px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.06);">')
        out.push('<table style="width:100%;border-collapse:collapse;font-size:12px;">')
        out.push('<tbody>')
        inTable = true
      }
      const cells = line.split('|').slice(1, -1).map((c) => c.trim())
      const isHeaderRow = !tableHasHeader && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1].trim())

      if (isHeaderRow) {
        const row = cells.map((c) =>
          `<th style="padding:9px 13px;text-align:left;font-weight:700;font-size:11px;color:#374151;background:#f8fafc;border-bottom:2px solid #e2e8f0;white-space:nowrap;text-transform:uppercase;letter-spacing:0.04em;">${inline(c)}</th>`
        ).join('')
        out.push(`<tr>${row}</tr>`)
      } else {
        const row = cells.map((c) =>
          `<td style="padding:8px 13px;color:#475569;border-bottom:1px solid #f1f5f9;vertical-align:top;line-height:1.5;">${inlineWithBadges(c)}</td>`
        ).join('')
        out.push(`<tr style="transition:background .1s;">${row}</tr>`)
      }
      continue
    }

    closeTable()

    // Numbered list item
    const numListM = line.match(/^(\d+)\. (.+)$/)
    if (numListM) {
      closeBlockquote(); if (inList) closeList()
      if (!inOrderedList) {
        out.push('<ol style="margin:8px 0;padding:0;list-style:none;counter-reset:li;">')
        inOrderedList = true
      }
      out.push(`<li style="font-size:12.5px;color:#475569;line-height:1.65;margin-bottom:5px;padding-left:26px;position:relative;"><span style="position:absolute;left:0;top:0;font-weight:700;color:#6366f1;font-size:12px;">${numListM[1]}.</span>${inline(numListM[2])}</li>`)
      continue
    }

    // Bullet list item
    const listM = line.match(/^[-*•] (.+)$/)
    if (listM) {
      closeBlockquote(); if (inOrderedList) closeList()
      if (!inList) {
        out.push('<ul style="margin:8px 0;padding:0;list-style:none;">')
        inList = true
      }
      out.push(`<li style="font-size:12.5px;color:#475569;line-height:1.65;margin-bottom:5px;padding-left:18px;position:relative;"><span style="position:absolute;left:0;top:6px;width:6px;height:6px;border-radius:50%;background:#6366f1;display:inline-block;flex-shrink:0;"></span>${inline(listM[1])}</li>`)
      continue
    }

    closeList()

    // Empty line
    if (!line) continue

    // Paragraph
    out.push(`<p style="font-size:12.5px;color:#475569;line-height:1.7;margin:5px 0;">${inlineWithBadges(line)}</p>`)
  }

  closeList()
  closeTable()
  closeBlockquote()

  return out.join('\n')
}

// ─── Status badge definitions ────────────────────────────────────────────────

const STATUS_BADGES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  MATCH:               { bg: '#ecfdf5', border: '#6ee7b7', color: '#059669', label: '✓ MATCH' },
  VIOLATION:           { bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', label: '✕ VIOLATION' },
  NOT_FOUND:           { bg: '#eff6ff', border: '#93c5fd', color: '#2563eb', label: '? NOT FOUND' },
  PARTIALLY_SATISFIED: { bg: '#fffbeb', border: '#fcd34d', color: '#d97706', label: '~ PARTIAL' },
  HIGH:                { bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', label: '↑ HIGH' },
  MEDIUM:              { bg: '#fffbeb', border: '#fcd34d', color: '#d97706', label: '→ MEDIUM' },
  LOW:                 { bg: '#ecfdf5', border: '#6ee7b7', color: '#059669', label: '↓ LOW' },
}

// ─── Inline renderers ────────────────────────────────────────────────────────

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700;color:#1e293b;">$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em style="font-style:italic;color:#64748b;">$1</em>')
    .replace(
      /`([^`]+?)`/g,
      '<code style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:1px 5px;font-size:11px;font-family:ui-monospace,\'Fira Mono\',monospace;color:#6366f1;">$1</code>'
    )
}

function inlineWithBadges(text: string): string {
  const withBadges = text.replace(
    /\b(MATCH|VIOLATION|NOT_FOUND|PARTIALLY_SATISFIED|HIGH|MEDIUM|LOW)\b/g,
    (match) => {
      const cfg = STATUS_BADGES[match]
      if (!cfg) return match
      return `<span style="display:inline-flex;align-items:center;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};border-radius:20px;padding:2px 9px;font-size:10px;font-weight:700;white-space:nowrap;letter-spacing:0.03em;vertical-align:middle;">${cfg.label}</span>`
    }
  )
  return inline(withBadges)
}

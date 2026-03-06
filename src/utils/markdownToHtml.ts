/**
 * Lightweight Markdown → HTML converter.
 * Handles the specific patterns produced by the clause-analysis API summary:
 *   ## / ### headings, **bold**, | tables |, --- rules, - lists, paragraphs
 */
export function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inTable = false
  let tableHasHeader = false
  let inList = false

  const closeTable = () => {
    if (!inTable) return
    out.push('</tbody></table>')
    inTable = false
    tableHasHeader = false
  }

  const closeList = () => {
    if (!inList) return
    out.push('</ul>')
    inList = false
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()

    // Horizontal rule
    if (/^---+$/.test(line)) {
      closeTable()
      closeList()
      out.push('<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />')
      continue
    }

    // H2
    const h2 = line.match(/^## (.+)$/)
    if (h2) {
      closeTable()
      closeList()
      out.push(`<h2 style="font-size:13px;font-weight:700;color:#1e293b;margin:18px 0 6px;">${inline(h2[1])}</h2>`)
      continue
    }

    // H3
    const h3 = line.match(/^### (.+)$/)
    if (h3) {
      closeTable()
      closeList()
      out.push(`<h3 style="font-size:12px;font-weight:700;color:#334155;margin:12px 0 4px;">${inline(h3[1])}</h3>`)
      continue
    }

    // Table separator row — skip it but mark that the next rows are data
    if (/^\|[\s:|-]+\|/.test(line)) {
      tableHasHeader = true
      continue
    }

    // Table row
    if (line.startsWith('|')) {
      if (!inTable) {
        out.push(
          '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0;">',
          '<tbody>',
        )
        inTable = true
      }
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())

      // Is this the first row and we haven't seen a separator yet?
      const isHeaderRow = !tableHasHeader && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1].trim())
      const tag = isHeaderRow ? 'th' : 'td'
      const cellStyle = isHeaderRow
        ? 'border:1px solid #e2e8f0;padding:6px 10px;text-align:left;font-weight:700;background:#f8fafc;'
        : 'border:1px solid #e2e8f0;padding:6px 10px;text-align:left;'

      const row = cells.map((c) => `<${tag} style="${cellStyle}">${inline(c)}</${tag}>`).join('')
      out.push(`<tr>${row}</tr>`)
      continue
    }

    // Close table when we hit a non-table line
    closeTable()

    // List item
    const listM = line.match(/^[-*] (.+)$/)
    if (listM) {
      if (!inList) {
        out.push('<ul style="margin:6px 0 6px 16px;padding:0;list-style:disc;">')
        inList = true
      }
      out.push(`<li style="font-size:12px;color:#475569;line-height:1.6;margin-bottom:2px;">${inline(listM[1])}</li>`)
      continue
    }

    closeList()

    // Empty line → skip
    if (!line) continue

    // Paragraph
    out.push(`<p style="font-size:12.5px;color:#475569;line-height:1.65;margin:4px 0;">${inline(line)}</p>`)
  }

  closeList()
  closeTable()

  return out.join('\n')
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+?)`/g, '<code style="background:#f1f5f9;border-radius:3px;padding:1px 4px;font-size:11px;font-family:monospace;">$1</code>')
}

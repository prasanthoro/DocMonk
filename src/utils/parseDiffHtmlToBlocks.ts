import type { DiffBlockData, DiffType } from '../components/editor/DiffBlockTool'
import type { ClauseAnalysis } from '../types/clauseAnalysis'

interface EditorBlock {
  type: string
  data: Record<string, unknown>
}

/**
 * Parses the diff-report HTML returned by the analysis API
 * into an EditorJS block array.
 *
 * - `.diff-group[data-type="unchanged"]` → `paragraph` block
 * - `.diff-group[data-type="modified"|"partial"|"new"]` → `diffBlock` block
 *
 * Processes groups in chunks to avoid blocking the main thread.
 * Yields to the browser every 50 groups.
 */
export async function parseDiffHtmlToBlocks(html: string): Promise<EditorBlock[]> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Yield immediately after the heavy sync DOMParser call
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const groups = Array.from(doc.querySelectorAll('.diff-group'))

  const blocks: EditorBlock[] = []
  const CHUNK_SIZE = 30

  for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
    const chunk = groups.slice(i, i + CHUNK_SIZE)

    for (const group of chunk) {
      const dataType = group.getAttribute('data-type') || 'unchanged'

      if (dataType === 'unchanged') {
        const normalEl = group.querySelector('.diff-line.normal .line-content')
        const text = (normalEl?.textContent || '').trim()
        if (text) {
          blocks.push({ type: 'paragraph', data: { text } })
        }
        continue
      }

      // Changed: modified / partial / new
      const reason = group.querySelector('.reason-tooltip')?.textContent?.trim() || ''

      const deletedEl = group.querySelector('.diff-line.deleted .line-content')
      const oldTextEl = deletedEl?.querySelector('.old-text')
      const deletedText = ((oldTextEl?.textContent || deletedEl?.textContent) ?? '').trim()

      const addedEl = group.querySelector(
        '.diff-line.added .line-content, .diff-line.new-clause .line-content',
      )
      const addedText = (addedEl?.textContent ?? '').trim()

      const data: DiffBlockData = {
        diffType: dataType as DiffType,
        deletedText,
        addedText,
        reason,
        decision: null,
      }

      blocks.push({ type: 'diffBlock', data: data as unknown as Record<string, unknown> })
    }

    // Yield to browser after each chunk using rAF (not setTimeout which can batch)
    if (i + CHUNK_SIZE < groups.length) {
      await new Promise((r) => requestAnimationFrame(r))
    }
  }

  return blocks
}

// ─── Compliance analysis summary from diff HTML ───────────────────────────────

/**
 * Parse the diff-report HTML into a ClauseAnalysis array so the frontend can
 * render the Compliance Analysis Report (score wheel, stat pills, clause cards)
 * even when the backend only returns diff HTML in report_md_base64.
 *
 * Mapping:
 *   data-type="modified" → VIOLATION
 *   data-type="partial"  → PARTIALLY_SATISFIED
 *   data-type="new"      → NOT_FOUND
 *   data-type="unchanged" → skipped (no named clause identity)
 */
export async function parseDiffHtmlToAnalysisSummary(html: string): Promise<ClauseAnalysis[]> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Yield after heavy sync DOMParser call
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const groups = Array.from(doc.querySelectorAll('.diff-group'))
  const items: ClauseAnalysis[] = []
  let idx = 0
  const CHUNK_SIZE = 30

  for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
    const chunk = groups.slice(i, i + CHUNK_SIZE)

    for (const group of chunk) {
      const dataType = group.getAttribute('data-type') || 'unchanged'
      if (dataType === 'unchanged') continue

      idx++
      const reason = group.querySelector('.reason-tooltip')?.textContent?.trim() || ''

      const deletedEl = group.querySelector('.diff-line.deleted .line-content')
      const oldTextEl = deletedEl?.querySelector('.old-text')
      const deletedText = ((oldTextEl?.textContent || deletedEl?.textContent) ?? '').trim()

      const addedEl = group.querySelector(
        '.diff-line.added .line-content, .diff-line.new-clause .line-content',
      )
      const addedText = (addedEl?.textContent ?? '').trim()

      const resultMap: Record<string, ClauseAnalysis['result']> = {
        modified: 'VIOLATION',
        partial: 'PARTIALLY_SATISFIED',
        new: 'NOT_FOUND',
      }
      const result = resultMap[dataType]
      if (!result) continue

      const titleSource = reason || deletedText || addedText || `Issue ${idx}`
      const clauseTitle = titleSource.length > 72 ? titleSource.slice(0, 69) + '…' : titleSource

      const defaultReason =
        result === 'NOT_FOUND'
          ? 'This clause is missing from the document.'
          : result === 'VIOLATION'
            ? 'Clause content does not match the expected language.'
            : 'Clause is only partially satisfied.'

      items.push({
        clause_id: `diff_${idx}`,
        clause_title: clauseTitle,
        result,
        reason: reason || defaultReason,
        relevant_text: deletedText || null,
        ai_added_text: addedText || null,
      })
    }

    // Yield to browser after each chunk
    if (i + CHUNK_SIZE < groups.length) {
      await new Promise((r) => requestAnimationFrame(r))
    }
  }

  return items
}

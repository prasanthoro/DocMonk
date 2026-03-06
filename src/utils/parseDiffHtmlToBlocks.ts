import type { DiffBlockData, DiffType } from '../components/editor/DiffBlockTool'

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
 */
export function parseDiffHtmlToBlocks(html: string): EditorBlock[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const groups = doc.querySelectorAll('.diff-group')
  const blocks: EditorBlock[] = []

  groups.forEach((group) => {
    const dataType = group.getAttribute('data-type') || 'unchanged'

    if (dataType === 'unchanged') {
      const normalEl = group.querySelector('.diff-line.normal .line-content')
      const text = (normalEl?.textContent || '').trim()
      if (text) {
        blocks.push({ type: 'paragraph', data: { text } })
      }
      return
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
  })

  return blocks
}

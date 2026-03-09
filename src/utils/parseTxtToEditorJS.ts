interface EditorBlock {
  type: string
  data: Record<string, unknown>
}

/**
 * Parse a plain-text file into EditorJS blocks.
 * - Blank lines separate paragraphs.
 * - Short lines (≤60 chars) that are ALL-CAPS or Title Case followed by a blank line → header.
 */
export async function parseTxtToEditorJS(file: File): Promise<{
  time: number
  blocks: EditorBlock[]
  version: string
}> {
  const text = await file.text()
  const rawLines = text.split(/\r?\n/)

  // Group consecutive non-empty lines into chunks separated by blank lines
  const chunks: string[][] = []
  let current: string[] = []
  for (const line of rawLines) {
    if (line.trim() === '') {
      if (current.length) { chunks.push(current); current = [] }
    } else {
      current.push(line.trim())
    }
  }
  if (current.length) chunks.push(current)

  const blocks: EditorBlock[] = []

  for (const chunk of chunks) {
    const text = chunk.join(' ').trim()
    if (!text) continue

    // Detect heading: single line, ≤80 chars, either ALL-CAPS or ends with no period
    const isSingleLine = chunk.length === 1
    const isShort = text.length <= 80
    const isAllCaps = text === text.toUpperCase() && /[A-Z]/.test(text)
    const looksLikeHeading = isSingleLine && isShort && (isAllCaps || !/[.!?]$/.test(text))

    if (looksLikeHeading) {
      blocks.push({ type: 'header', data: { text, level: 3 } })
    } else {
      blocks.push({ type: 'paragraph', data: { text } })
    }
  }

  return { time: Date.now(), blocks, version: '2.31.4' }
}

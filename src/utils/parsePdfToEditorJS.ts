// pdfjs-dist is loaded lazily inside the function to avoid SSR evaluation
// (DOMMatrix and other browser APIs are not available in Node/server context)

interface EditorBlock {
  type: string
  data: Record<string, unknown>
}

interface RawItem {
  str: string
  height: number
  x: number
  y: number
  page: number
}

// Items within this many PDF units share the same line
const Y_TOLERANCE = 4

export async function parsePdfToEditorJS(file: File): Promise<{
  time: number
  blocks: EditorBlock[]
  version: string
}> {
  // Dynamic import — only runs in the browser, never during SSR
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href

  const arrayBuffer = await file.arrayBuffer()

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    verbosity: 0,
  })
  const pdfDoc = await loadingTask.promise

  // ── Collect every text item from every page ──────────────────────────────
  const allItems: RawItem[] = []

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent()

    for (const item of textContent.items) {
      if (!('str' in item)) continue
      const ti = item as any
      const str = String(ti.str ?? '').trim()
      if (!str) continue

      const height = Number(ti.height) || 10
      const x = Number(ti.transform?.[4]) || 0
      // PDF y=0 is bottom-left — flip to top-relative for reading order
      const y = viewport.height - Number(ti.transform?.[5] ?? 0)

      allItems.push({ str, height, x, y, page: p })
    }
  }

  if (!allItems.length) {
    return { time: Date.now(), blocks: [], version: '2.31.4' }
  }

  // ── Find the most common font height = "body text" ───────────────────────
  const hFreq: Record<number, number> = {}
  for (const { height } of allItems) {
    const h = Math.round(height)
    hFreq[h] = (hFreq[h] || 0) + 1
  }
  const bodyHeight = Number(
    Object.entries(hFreq).sort(([, a], [, b]) => b - a)[0][0],
  )

  // ── Sort items into reading order: page asc → y asc → x asc ─────────────
  const sorted = [...allItems].sort(
    (a, b) => a.page - b.page || a.y - b.y || a.x - b.x,
  )

  // ── Group items that share the same visual line ───────────────────────────
  type Line = { texts: string[]; height: number; y: number; page: number }
  const lines: Line[] = []

  for (const item of sorted) {
    const last = lines[lines.length - 1]
    if (
      last &&
      last.page === item.page &&
      Math.abs(last.y - item.y) <= Y_TOLERANCE
    ) {
      last.texts.push(item.str)
      last.height = Math.max(last.height, item.height)
    } else {
      lines.push({
        texts: [item.str],
        height: item.height,
        y: item.y,
        page: item.page,
      })
    }
  }

  // ── Merge consecutive lines into paragraphs then emit EditorJS blocks ─────
  const blocks: EditorBlock[] = []
  let paraTexts: string[] = []
  let paraHeight = 0
  let prevBottomY = -1
  let prevPage = -1

  const flush = () => {
    const text = paraTexts.join(' ').trim()
    if (!text) { paraTexts = []; paraHeight = 0; return }

    const isHeading = paraHeight > bodyHeight * 1.18
    const level = paraHeight > bodyHeight * 1.55 ? 2 : 3

    blocks.push(
      isHeading
        ? { type: 'header', data: { text, level } }
        : { type: 'paragraph', data: { text } },
    )
    paraTexts = []
    paraHeight = 0
  }

  for (const line of lines) {
    const lineText = line.texts.join(' ').trim()
    if (!lineText) continue

    const pageChanged = line.page !== prevPage && prevPage !== -1
    const gap = pageChanged ? 9999 : prevBottomY < 0 ? 0 : line.y - prevBottomY

    // New paragraph when the gap between lines is larger than 1.4× line height
    if (gap > line.height * 1.4 || pageChanged) {
      flush()
    }

    paraTexts.push(lineText)
    paraHeight = Math.max(paraHeight, line.height)
    prevBottomY = line.y + line.height
    prevPage = line.page
  }
  flush()

  return { time: Date.now(), blocks, version: '2.31.4' }
}

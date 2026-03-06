/**
 * Convert an EditorJS output object to an HTML string suitable for
 * sending to the DocMonk analysis API as document_base64 content.
 */

interface Block {
  type: string
  data: any
}

interface EditorData {
  blocks: Block[]
}

// ─── Block renderers ─────────────────────────────────────────────────────────

function renderHeader(data: any): string {
  const level = Math.min(Math.max(data.level || 2, 1), 6)
  const text = data.text || ''
  const align = data.alignment || data.align || 'left'
  return `<h${level} style="text-align:${align}">${text}</h${level}>`
}

function renderParagraph(data: any): string {
  const text = data.text || ''
  const align = data.alignment || data.align || ''
  const style = align ? ` style="text-align:${align}"` : ''
  return `<p${style}>${text}</p>`
}

function renderListItems(items: any[], style: string, depth = 0): string {
  const tag = style === 'ordered' ? 'ol' : 'ul'
  const innerItems = items
    .map((item) => {
      const text = typeof item === 'string' ? item : item.content || ''
      const nestedItems = item?.items?.length
        ? renderListItems(item.items, style, depth + 1)
        : ''
      return `<li>${text}${nestedItems}</li>`
    })
    .join('\n')
  return `<${tag}>${innerItems}</${tag}>`
}

function renderList(data: any): string {
  const style = data.style || 'unordered'
  const items = data.items || []
  return renderListItems(items, style)
}

function renderTable(data: any): string {
  const content: string[][] = data.content || []
  const withHeadings = data.withHeadings ?? false

  if (!content.length) return ''

  const rows = content.map((row, rowIdx) => {
    const cells = row
      .map((cell) => {
        const tag = withHeadings && rowIdx === 0 ? 'th' : 'td'
        return `<${tag} style="border:1px solid #e2e8f0;padding:6px 10px;">${cell}</${tag}>`
      })
      .join('')
    return `<tr>${cells}</tr>`
  })

  return `<table style="border-collapse:collapse;width:100%;font-size:14px;">\n${rows.join('\n')}\n</table>`
}

function renderImage(data: any): string {
  const url = data.url || data.file?.url || ''
  const caption = data.caption || ''
  if (!url) return ''
  const styleArr = ['max-width:100%']
  if (data.stretched) styleArr.push('width:100%')
  if (data.withBorder) styleArr.push('border:1px solid #e2e8f0')
  if (data.withBackground) styleArr.push('background:#f8fafc;padding:16px')
  const styles = styleArr.join(';')
  return `<figure style="margin:0;text-align:center">
  <img src="${url}" alt="${caption}" style="${styles}" />
  ${caption ? `<figcaption style="font-size:12px;color:#64748b;margin-top:6px">${caption}</figcaption>` : ''}
</figure>`
}

function renderQuote(data: any): string {
  const text = data.text || ''
  const caption = data.caption || ''
  const align = data.alignment || 'left'
  return `<blockquote style="border-left:3px solid #94a3b8;margin:0;padding:8px 16px;color:#475569;font-style:italic;text-align:${align}">
  <p>${text}</p>
  ${caption ? `<cite style="font-size:12px;color:#94a3b8">${caption}</cite>` : ''}
</blockquote>`
}

function renderDelimiter(): string {
  return `<hr style="border:none;border-top:2px solid #e2e8f0;margin:24px 0;" />`
}

function renderCode(data: any): string {
  const code = data.code || ''
  return `<pre style="background:#1e293b;color:#e2e8f0;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;"><code>${code}</code></pre>`
}

function renderWarning(data: any): string {
  const title = data.title || 'Warning'
  const message = data.message || ''
  return `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
  <strong style="color:#92400e">${title}</strong>
  ${message ? `<p style="margin:4px 0 0;color:#78350f;font-size:14px">${message}</p>` : ''}
</div>`
}

// ─── Main converter ───────────────────────────────────────────────────────────

export function editorjsToHtml(data: EditorData): string {
  if (!data?.blocks?.length) return ''

  const parts = data.blocks
    .filter(Boolean)
    .map((block): string => {
      switch (block.type) {
        case 'header':
          return renderHeader(block.data)
        case 'paragraph':
          return renderParagraph(block.data)
        case 'list':
          return renderList(block.data)
        case 'table':
          return renderTable(block.data)
        case 'image':
          return renderImage(block.data)
        case 'quote':
          return renderQuote(block.data)
        case 'delimiter':
          return renderDelimiter()
        case 'code':
          return renderCode(block.data)
        case 'warning':
          return renderWarning(block.data)
        default:
          // Fallback: try to extract text from .data.text
          if (block.data?.text) return `<p>${block.data.text}</p>`
          return ''
      }
    })
    .filter(Boolean)

  return `<div style="font-family:sans-serif;font-size:15px;line-height:1.75;color:#1e293b">\n${parts.join('\n')}\n</div>`
}

/**
 * Simplified HTML → EditorJS converter.
 * Parses basic HTML tags into EditorJS block format.
 * No esigns.io-specific form field dependencies.
 */
export function htmlToEditorjs(html: string): { time: number; blocks: any[]; version: string } {
  const blocks: any[] = []

  // Use DOMParser to parse the HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const body = doc.body

  function processNode(node: Element): any | null {
    const tag = node.tagName?.toLowerCase()

    if (!tag) return null

    // Headers
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      return {
        type: 'header',
        data: {
          text: node.innerHTML || '',
          level: parseInt(tag[1], 10),
        },
      }
    }

    // Paragraph
    if (tag === 'p') {
      const text = node.innerHTML?.trim() || ''
      if (!text) return null
      return { type: 'paragraph', data: { text } }
    }

    // Lists
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(node.querySelectorAll(':scope > li')).map((li) => ({
        content: (li as HTMLElement).innerHTML?.replace(/<ul[\s\S]*?>[\s\S]*?<\/ul>/gi, '').replace(/<ol[\s\S]*?>[\s\S]*?<\/ol>/gi, '').trim() || '',
        items: [],
      }))
      return {
        type: 'list',
        data: {
          style: tag === 'ol' ? 'ordered' : 'unordered',
          items,
        },
      }
    }

    // Table
    if (tag === 'table') {
      const rows = Array.from(node.querySelectorAll('tr'))
      const content = rows.map((row) =>
        Array.from(row.querySelectorAll('td, th')).map((cell) => (cell as HTMLElement).innerHTML?.trim() || '')
      )
      const withHeadings = !!node.querySelector('th')
      return { type: 'table', data: { content, withHeadings } }
    }

    // Image
    if (tag === 'img') {
      return {
        type: 'image',
        data: {
          url: (node as HTMLImageElement).src || '',
          caption: (node as HTMLImageElement).alt || '',
          withBorder: false,
          withBackground: false,
          stretched: false,
        },
      }
    }

    // Blockquote
    if (tag === 'blockquote') {
      const p = node.querySelector('p')
      const cite = node.querySelector('cite')
      return {
        type: 'quote',
        data: {
          text: p ? p.innerHTML : node.innerHTML || '',
          caption: cite ? cite.innerHTML : '',
          alignment: 'left',
        },
      }
    }

    // HR → delimiter
    if (tag === 'hr') {
      return { type: 'delimiter', data: {} }
    }

    // Pre / code
    if (tag === 'pre') {
      const code = node.querySelector('code')
      return { type: 'code', data: { code: code ? code.textContent : node.textContent || '' } }
    }

    // Div / section — recurse into children
    if (['div', 'section', 'article', 'main', 'figure'].includes(tag)) {
      // If div only contains text nodes / inline elements, treat as paragraph
      const onlyInline = Array.from(node.childNodes).every(
        (child) =>
          child.nodeType === Node.TEXT_NODE ||
          ['span', 'strong', 'em', 'b', 'i', 'u', 'a', 'br', 'code', 'mark'].includes(
            (child as Element).tagName?.toLowerCase() || ''
          )
      )
      if (onlyInline) {
        const text = node.innerHTML?.trim() || ''
        if (!text) return null
        return { type: 'paragraph', data: { text } }
      }
      // Otherwise flatten children into blocks
      const childBlocks: any[] = []
      for (const child of Array.from(node.children)) {
        const block = processNode(child as Element)
        if (block) {
          if (Array.isArray(block)) childBlocks.push(...block)
          else childBlocks.push(block)
        }
      }
      return childBlocks.length ? childBlocks : null
    }

    return null
  }

  for (const child of Array.from(body.children)) {
    const result = processNode(child as Element)
    if (result) {
      if (Array.isArray(result)) blocks.push(...result)
      else blocks.push(result)
    }
  }

  // If no structured blocks found, split by newline and make paragraphs
  if (!blocks.length && body.textContent?.trim()) {
    const lines = body.textContent.split('\n').filter((l) => l.trim())
    lines.forEach((line) => blocks.push({ type: 'paragraph', data: { text: line.trim() } }))
  }

  return { time: Date.now(), blocks, version: '2.30.8' }
}

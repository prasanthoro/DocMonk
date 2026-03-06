import { encodeBase64, fileToBase64 } from '../utils/base64'
import { editorjsToHtml } from '../utils/editorjsToHtml'
import type { Clause, AnalysisResponse } from '../types/clauseAnalysis'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://docmonk-production.up.railway.app'

// 120-second timeout for analysis requests
const ANALYZE_TIMEOUT_MS = 120_000

// ─── Document base64 builder ─────────────────────────────────────────────────

export async function buildDocumentBase64(
  file: File | null,
  editorData: any
): Promise<{ b64: string; filename: string }> {
  const ext = file?.name.split('.').pop()?.toLowerCase()

  // PDF / TXT / MD → raw file bytes as base64
  if (file && (ext === 'pdf' || ext === 'txt' || ext === 'md')) {
    const b64 = await fileToBase64(file)
    return { b64, filename: file.name }
  }

  // DOCX (parsed to editorData) or manually typed content → EditorJS → HTML → base64
  if (editorData?.blocks?.length) {
    const html = editorjsToHtml(editorData)
    const b64 = encodeBase64(html)
    return {
      b64,
      filename: file?.name || 'document.html',
    }
  }

  throw new Error('No document content. Please upload a file or type your contract in the editor.')
}

// ─── Duplicate clause ID validation ──────────────────────────────────────────

export function validateClauses(clauses: Clause[]): string | null {
  const valid = clauses.filter((c) => c.title.trim() && c.value.trim())
  if (valid.length === 0) {
    return 'Add at least one clause with a title and description.'
  }

  const ids = valid.map((c) => c.id.trim().toLowerCase())
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      return `Duplicate clause ID detected: "${id}". Each clause must have a unique ID.`
    }
    seen.add(id)
  }

  return null
}

// ─── Analyze API ──────────────────────────────────────────────────────────────

export async function analyzeDocument(
  file: File | null,
  editorData: any,
  clauses: Clause[]
): Promise<AnalysisResponse> {
  const validClauses = clauses.filter((c) => c.title.trim() && c.value.trim())

  const { b64, filename } = await buildDocumentBase64(file, editorData)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS)

  try {
    const res = await fetch(`${BASE_URL}/v1/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_base64: b64,
        document_filename: filename,
        clauses: validClauses.map((c) => ({
          id: c.id.trim(),
          category: c.category,
          title: c.title.trim(),
          value: c.value.trim(),
        })),
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText)
      throw new Error(body || `Analysis failed with status ${res.status}`)
    }

    return res.json() as Promise<AnalysisResponse>
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Analysis timed out after 120 seconds. The document may be too large.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

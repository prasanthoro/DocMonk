import { encodeBase64, fileToBase64 } from '../utils/base64'
import { editorjsToHtml } from '../utils/editorjsToHtml'
import type { Clause, AnalysisResponse } from '../types/clauseAnalysis'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://docmonk-production.up.railway.app'

// ─── Resume-loop helper ───────────────────────────────────────────────────────

/**
 * If the initial analyze response has can_resume=true, the backend still has
 * more data to send (analysis_summary, summary_md_base64, etc.).
 * Keep calling POST /v1/jobs/{jobId}/resume until can_resume is false or we
 * run out of retries. Merges each response into the accumulated data object.
 */
async function resumeUntilComplete(
  data: Record<string, any>,
  signal: AbortSignal,
  maxRetries = 10,
): Promise<Record<string, any>> {
  let merged = { ...data }
  let retries = 0

  while (merged.can_resume && merged.job_id && retries < maxRetries) {
    retries++
    await new Promise((r) => setTimeout(r, 800)) // brief back-off between retries

    const res = await fetch(`${BASE_URL}/v1/jobs/${merged.job_id}/resume`, {
      method: 'POST',
      signal,
    })
    if (!res.ok) break

    const chunk = await res.json()
    console.log(`[DocMonk] resume #${retries} keys:`, Object.keys(chunk).join(', '))

    // Merge: newer chunk fields overwrite, but don't clear existing values with null/undefined
    for (const key of Object.keys(chunk)) {
      if (chunk[key] !== null && chunk[key] !== undefined) {
        merged[key] = chunk[key]
      }
    }
  }

  return merged
}

// 2-minute timeout — AI analysis can take 10-60s depending on document size
const ANALYZE_TIMEOUT_MS = 120_000

// ─── Document base64 builder ─────────────────────────────────────────────────

export async function buildDocumentBase64(
  file: File | null,
  editorData: any
): Promise<{ b64: string; filename: string }> {
  if (file) {
    const b64 = await fileToBase64(file)
    return { b64, filename: file.name }
  }

  if (editorData?.blocks?.length) {
    const html = editorjsToHtml(editorData)
    const b64 = encodeBase64(html)
    return { b64, filename: 'document.html' }
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
  clauses: Clause[],
  context?: string
): Promise<AnalysisResponse> {
  const validClauses = clauses.filter((c) => c.title.trim() && c.value.trim())

  const { b64, filename } = await buildDocumentBase64(file, editorData)

  const body: Record<string, any> = {
    document_base64: b64,
    document_filename: filename,
    clauses: validClauses.map((c) => ({
      id: c.id.trim(),
      category: c.category,
      title: c.title.trim(),
      value: c.value.trim(),
    })),
  }
  if (context?.trim()) body.context = context.trim()

  const url = `${BASE_URL}/v1/analyze`

  // AbortController for timeout
  const controller = new AbortController()
  const abortTimer = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(abortTimer)

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(text || `Analysis failed with status ${res.status}`)
    }

    let data = await res.json()

    // Debug: log all API keys and short-circuit base64 blobs so nothing is hidden
    console.log('[DocMonk] API keys:', Object.keys(data).join(', '))

    // If the backend signals more data is available, fetch it now
    if (data.can_resume && data.job_id) {
      data = await resumeUntilComplete(data, controller.signal)
      console.log('[DocMonk] after resume, keys:', Object.keys(data).join(', '))
    }
    const preview: Record<string, unknown> = {}
    for (const k of Object.keys(data)) {
      const v = (data as any)[k]
      preview[k] = typeof v === 'string' && v.length > 80 ? `[base64 ${v.length}ch]` : v
    }
    console.log('[DocMonk] API values:', preview)

    // Normalize analysis_summary from alternative field names the API might use
    if (!data.analysis_summary?.length) {
      const alt = data.results ?? data.clause_results ?? data.analysis ?? data.clauses ?? data.clause_analysis
      if (Array.isArray(alt) && alt.length > 0) {
        data.analysis_summary = alt
      }
    }

    // Normalize summary_md_base64 from alternative field names
    if (!data.summary_md_base64) {
      data.summary_md_base64 = data.summary_base64 ?? data.summary_md ?? data.md_summary ?? null
    }

    return data as AnalysisResponse
  } catch (err: any) {
    clearTimeout(abortTimer)

    if (err.name === 'AbortError') {
      throw new Error('Analysis timed out. The AI is taking too long to process your document. Please try with a smaller document or fewer clauses.')
    }

    throw err
  }
}

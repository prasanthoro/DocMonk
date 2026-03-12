import { encodeBase64, fileToBase64 } from '../utils/base64'
import { editorjsToHtml } from '../utils/editorjsToHtml'
import type { Clause, AnalysisResponse } from '../types/clauseAnalysis'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://docmonk-production.up.railway.app'

// 10-second timeout for analysis requests (faster feedback when backend is slow/hanging)
const ANALYZE_TIMEOUT_MS = 10_000

// ─── Document base64 builder ─────────────────────────────────────────────────

export async function buildDocumentBase64(
  file: File | null,
  editorData: any
): Promise<{ b64: string; filename: string }> {
  // Always prefer raw file bytes when a file is available
  if (file) {
    const b64 = await fileToBase64(file)
    console.log('[buildDocumentBase64] File base64 first 100 chars:', b64.substring(0, 100))
    console.log('[buildDocumentBase64] File base64 last 50 chars:', b64.substring(b64.length - 50))
    // Validate base64 format
    const b64Clean = b64.replace(/^data:[^;]+;base64,/, '')
    if (!/^[A-Za-z0-9+/=]*$/.test(b64Clean)) {
      console.error('[buildDocumentBase64] Invalid characters in base64!')
    }
    return { b64, filename: file.name }
  }

  // Fallback: manually typed content → EditorJS → HTML → base64
  if (editorData?.blocks?.length) {
    const html = editorjsToHtml(editorData)
    const b64 = encodeBase64(html)
    console.log('[buildDocumentBase64] HTML base64 first 100 chars:', b64.substring(0, 100))
    console.log('[buildDocumentBase64] HTML base64 last 50 chars:', b64.substring(b64.length - 50))
    // Validate base64 format
    if (!/^[A-Za-z0-9+/=]*$/.test(b64)) {
      console.error('[buildDocumentBase64] Invalid characters in base64!')
    }
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

  console.log('[analyzeService] Building document base64...')
  const { b64, filename } = await buildDocumentBase64(file, editorData)
  console.log('[analyzeService] Base64 ready, size:', b64.length, 'filename:', filename)

  try {
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
    const requestBody = JSON.stringify(body)

    console.log('[analyzeService] About to send fetch request')
    console.log('[analyzeService] URL:', url)
    console.log('[analyzeService] Request body size:', requestBody.length)

    // Quick CORS preflight test
    console.log('[analyzeService] Testing CORS preflight...')
    try {
      const corsTest = await Promise.race([
        fetch(url, { method: 'OPTIONS' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('CORS test timeout')), 2000))
      ])
      console.log('[analyzeService] CORS preflight OK, status:', corsTest.status)
    } catch (corsErr) {
      console.warn('[analyzeService] CORS preflight warning:', (corsErr as any)?.message)
    }

    const startTime = performance.now()

    // Create AbortController for better timeout handling
    const controller = new AbortController()
    const abortTimer = setTimeout(() => {
      console.log('[analyzeService] Timeout triggered, aborting fetch after', ANALYZE_TIMEOUT_MS, 'ms')
      controller.abort()
    }, ANALYZE_TIMEOUT_MS)

    try {
      console.log('[analyzeService] Initiating fetch...')
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: requestBody,
        signal: controller.signal,
      })

      clearTimeout(abortTimer)
      const elapsed = performance.now() - startTime

      console.log('[analyzeService] Response received after', elapsed.toFixed(2), 'ms')
      console.log('[analyzeService] Response status:', res.status)
      console.log('[analyzeService] Response headers:', {
        contentType: res.headers.get('content-type'),
        contentLength: res.headers.get('content-length'),
        cacheControl: res.headers.get('cache-control'),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        throw new Error(text || `Analysis failed with status ${res.status}`)
      }

      console.log('[analyzeService] Response body is ready, reading as text...')
      const readStart = performance.now()

      // Read response as text first to see size and detect issues
      const responseText = await res.text()
      const readElapsed = performance.now() - readStart

      console.log('[analyzeService] Response text read after', readElapsed.toFixed(2), 'ms, size:', responseText.length, 'bytes')

      // Yield to browser before heavy JSON parsing
      await new Promise(r => setTimeout(r, 0))
      console.log('[analyzeservice] Yielded to browser before JSON parsing')

      // Now parse JSON with timing
      const parseStart = performance.now()
      const data = JSON.parse(responseText)
      const parseElapsed = performance.now() - parseStart

      console.log('[analyzeservice] JSON parsed after', parseElapsed.toFixed(2), 'ms')
      console.log('[analyzeservice] Response structure:', {
        hasReport: !!data.report_md_base64,
        hasSummary: !!data.summary_md_base64,
        reportSize: data.report_md_base64?.length || 0,
        summarySize: data.summary_md_base64?.length || 0,
        summaryCount: data.analysis_summary?.length || 0,
      })
      return data as AnalysisResponse
    } catch (err: any) {
      clearTimeout(abortTimer)
      const elapsed = performance.now() - startTime

      if (err.name === 'AbortError') {
        console.error('[analyzeservice] Fetch aborted after', elapsed.toFixed(2), 'ms - timeout exceeded')
        throw new Error('Analysis service is not responding. The backend API may be down or processing too slowly. Please check with your administrator.')
      }

      console.error('[analyzeservice] Fetch error after', elapsed.toFixed(2), 'ms:', err.message)
      throw err
    }
  } catch (err: any) {
    console.error('[analyzeService] Error:', err.message || err)
    throw err
  }
}

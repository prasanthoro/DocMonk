import { encodeBase64, fileToBase64 } from '../utils/base64'
import { editorjsToHtml } from '../utils/editorjsToHtml'
import type { Clause, AnalysisResponse } from '../types/clauseAnalysis'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://docmonk-production.up.railway.app'

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

    const data = await res.json()

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

    // DEV ONLY: inject mock summary_json to test ComplianceReport UI
    if (import.meta.env.DEV && !data.summary_json) {
      data.summary_json = {
        compliance_score: 63,
        score_status: 'Needs Attention',
        stats: { total: 9, match: 3, violation: 4, partial: 1, not_found: 1 },
        agreement: { type: 'Commercial Rental Agreement', date: '2024-03-01', city: 'Mumbai', state: 'Maharashtra', party_a: 'Rajesh Properties Pvt Ltd', party_b: 'Infosys Technologies Ltd' },
        critical_issue_ids: ['governing_law_clause', 'security_deposit_clause', 'subletting_clause', 'termination_notice_clause'],
        clauses: [
          { index: 1, clause_id: 'rent_clause', clause_title: 'Monthly Rent', clause_value: 'The monthly rent shall be ₹3,00,000 payable on or before the 5th of each month.', category: 'Financial Risk', risk_level: 'MEDIUM', result: 'MATCH', reason: 'Rent amount and payment schedule clearly specified and compliant.', relevant_text: 'The monthly rent shall be ₹3,00,000 payable on or before the 5th of each month.', ai_added_text: null, parties_obligated: ['Tenant'], missing_values: [], binding_strength: 'STRONG', key_dates_durations: ['5th of each month'] },
          { index: 2, clause_id: 'lease_term_clause', clause_title: 'Lease Term', clause_value: 'The lease shall commence on 1st March 2024 and expire on 28th February 2027.', category: 'Operational Risk', risk_level: 'MEDIUM', result: 'MATCH', reason: 'Lease commencement, expiry, and total duration clearly defined.', relevant_text: 'The lease shall commence on 1st March 2024 and expire on 28th February 2027.', ai_added_text: null, parties_obligated: ['Landlord', 'Tenant'], missing_values: [], binding_strength: 'STRONG', key_dates_durations: ['1st March 2024 — commencement', '28th February 2027 — expiry'] },
          { index: 3, clause_id: 'security_deposit_clause', clause_title: 'Security Deposit', clause_value: 'Tenant shall deposit 12 months advance rent as security deposit.', category: 'Financial Risk', risk_level: 'HIGH', result: 'VIOLATION', reason: '12-month deposit exceeds the 6-month statutory cap under Maharashtra Rent Control Act 1999.', relevant_text: 'Tenant shall deposit 12 months advance rent of ₹36,00,000 as security deposit.', ai_added_text: 'Tenant shall deposit 6 months advance rent of ₹18,00,000 as security deposit prior to possession, in compliance with Maharashtra Rent Control Act 1999.', parties_obligated: ['Tenant'], missing_values: [], binding_strength: 'STRONG', key_dates_durations: ['prior to possession'] },
          { index: 4, clause_id: 'subletting_clause', clause_title: 'Subletting & Assignment', clause_value: 'Tenant may sublet without prior consent of the landlord.', category: 'Legal Risk', risk_level: 'HIGH', result: 'VIOLATION', reason: 'Unconditional subletting right is void under Section 15 of the Transfer of Property Act 1882.', relevant_text: 'Tenant may sublet or assign the premises without requiring prior consent of the landlord.', ai_added_text: 'Tenant shall not sublet, assign, or part with possession without prior written consent of the Landlord.', parties_obligated: ['Tenant'], missing_values: [], binding_strength: 'STRONG', key_dates_durations: [] },
          { index: 5, clause_id: 'termination_notice_clause', clause_title: 'Termination Notice Period', clause_value: 'Either party may terminate by giving 30 days written notice.', category: 'Legal Risk', risk_level: 'HIGH', result: 'VIOLATION', reason: '30-day notice is below the 90-day statutory minimum for commercial tenancies in Maharashtra.', relevant_text: 'Either party may terminate this agreement by giving 30 days written notice.', ai_added_text: 'Either party may terminate by giving 90 days written notice, per Maharashtra Rent Control Act 1999.', parties_obligated: ['Landlord', 'Tenant'], missing_values: [], binding_strength: 'STRONG', key_dates_durations: [] },
          { index: 6, clause_id: 'rent_escalation_clause', clause_title: 'Rent Escalation', clause_value: 'Rent shall escalate by 10% annually.', category: 'Financial Risk', risk_level: 'HIGH', result: 'PARTIALLY_SATISFIED', reason: 'Escalation rate specified but no cap or CPI-linked ceiling defined.', relevant_text: 'Rent shall escalate by 10% annually on each anniversary.', ai_added_text: 'Rent shall escalate by 5% annually, subject to a maximum cumulative escalation of 15% over the lease term.', parties_obligated: ['Tenant'], missing_values: ['escalation cap'], binding_strength: 'MODERATE', key_dates_durations: ['annually on each anniversary'] },
          { index: 7, clause_id: 'stamp_duty_clause', clause_title: 'Stamp Duty & Registration', clause_value: '', category: 'Process Risk', risk_level: 'LOW', result: 'NOT_FOUND', reason: 'No provision for stamp duty or mandatory registration under Maharashtra Stamp Act.', relevant_text: null, ai_added_text: 'This agreement shall be executed on stamp paper and registered with the Sub-Registrar within 4 months of execution.', parties_obligated: ['Landlord', 'Tenant'], missing_values: ['stamp duty provision'], binding_strength: 'VAGUE', key_dates_durations: [] },
          { index: 8, clause_id: 'governing_law_clause', clause_title: 'Governing Law & Jurisdiction', clause_value: 'Disputes subject to jurisdiction of Bangalore courts.', category: 'Legal Risk', risk_level: 'HIGH', result: 'VIOLATION', reason: 'Property is in Mumbai; Bangalore courts lack mandatory territorial jurisdiction.', relevant_text: 'disputes shall be subject to jurisdiction of Bangalore courts.', ai_added_text: 'Disputes shall be subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra.', parties_obligated: ['Landlord', 'Tenant'], missing_values: [], binding_strength: 'STRONG', key_dates_durations: [] },
          { index: 9, clause_id: 'maintenance_clause', clause_title: 'Maintenance & Repairs', clause_value: 'Tenant shall maintain premises; major structural repairs are landlord\'s responsibility.', category: 'Operational Risk', risk_level: 'MEDIUM', result: 'MATCH', reason: 'Responsibility allocated clearly between parties.', relevant_text: 'Major structural repairs are the responsibility of the landlord.', ai_added_text: null, parties_obligated: ['Landlord', 'Tenant'], missing_values: [], binding_strength: 'WEAK', key_dates_durations: [] },
        ],
        category_breakdown: [
          { name: 'Legal Risk', risk_level: 'HIGH', total: 4, compliant: 1, issues: 3, pass_rate: 25 },
          { name: 'Financial Risk', risk_level: 'HIGH', total: 3, compliant: 1, issues: 2, pass_rate: 33 },
          { name: 'Operational Risk', risk_level: 'MEDIUM', total: 2, compliant: 2, issues: 0, pass_rate: 100 },
          { name: 'Process Risk', risk_level: 'LOW', total: 1, compliant: 0, issues: 1, pass_rate: 0 },
        ],
        jurisdiction: {
          jurisdiction: 'Maharashtra, India',
          agreement_type: 'Commercial Rental Agreement',
          applicable_laws: ['Maharashtra Rent Control Act 1999', 'Transfer of Property Act 1882', 'Indian Contract Act 1872', 'Maharashtra Stamp Act 1958'],
          checklist: [
            { item: 'Agreement registered with Sub-Registrar of Assurances', required: true },
            { item: 'Stamp duty paid per Maharashtra Stamp Act schedule', required: true },
            { item: 'Security deposit within statutory 6-month cap', required: true },
            { item: 'Minimum 90-day termination notice', required: true },
            { item: 'Jurisdiction of courts at property location', required: true },
            { item: 'GST registration and TDS provisions included', required: false },
          ],
        },
        timeline: [
          { clause_title: 'Lease Term', item: '1st March 2024 — commencement' },
          { clause_title: 'Lease Term', item: '28th February 2027 — expiry' },
          { clause_title: 'Monthly Rent', item: '5th of each month — payment due' },
        ],
      }
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

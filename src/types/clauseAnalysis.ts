// ─── Clause input ────────────────────────────────────────────────────────────

export type ClauseCategory =
  | 'core'
  | 'financial'
  | 'legal'
  | 'penalty'
  | 'usage'
  | 'operational'
  | 'risk'
  | 'statutory'
  | 'execution'
  | 'confidentiality'
  | 'termination'
  | 'other'

export interface Clause {
  id: string          // user-editable slug; auto-generated from title
  title: string
  category: ClauseCategory
  value: string       // expected clause language / description
}

// ─── Analysis response ───────────────────────────────────────────────────────

export type ClauseResult = 'MATCH' | 'VIOLATION' | 'NOT_FOUND' | 'PARTIALLY_SATISFIED'

export interface ClauseAnalysis {
  clause_id: string
  clause_title: string
  clause_content?: string
  result: ClauseResult
  reason: string
  relevant_text?: string | null
  color?: string | null
  ai_added_text?: string | null
  parties_obligated?: string[]
  missing_values?: string[]
  binding_strength?: string
  key_dates_durations?: string[]
}

export interface Conflict {
  clause_ids: string[]
  description: string
  severity?: string
}

export interface Jurisdiction {
  jurisdiction: string
  applicable_laws?: string[]
}

export interface AnalysisResponse {
  status: string
  analysis_summary: ClauseAnalysis[]
  conflicts?: Conflict[]
  jurisdiction?: Jurisdiction
  report_md_base64?: string
  summary_md_base64?: string
}

// ─── UI state ────────────────────────────────────────────────────────────────

export type ResultTab = 'clauses' | 'report' | 'summary'

export const CLAUSE_CATEGORIES: { value: ClauseCategory; label: string }[] = [
  { value: 'core', label: 'Core' },
  { value: 'financial', label: 'Financial' },
  { value: 'legal', label: 'Legal' },
  { value: 'penalty', label: 'Penalty' },
  { value: 'usage', label: 'Usage' },
  { value: 'operational', label: 'Operational' },
  { value: 'risk', label: 'Risk' },
  { value: 'statutory', label: 'Statutory' },
  { value: 'execution', label: 'Execution' },
  { value: 'confidentiality', label: 'Confidentiality' },
  { value: 'termination', label: 'Termination' },
  { value: 'other', label: 'Other' },
]

export const STATUS_CONFIG: Record<
  ClauseResult,
  { bg: string; text: string; border: string; dot: string; label: string; icon: string }
> = {
  MATCH: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Match',
    icon: '✓',
  },
  VIOLATION: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
    label: 'Violation',
    icon: '✕',
  },
  NOT_FOUND: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    label: 'Not Found',
    icon: '?',
  },
  PARTIALLY_SATISFIED: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    label: 'Partial',
    icon: '~',
  },
}

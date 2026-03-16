import { useState } from 'react'
import type { AnalysisResponse, SummaryJsonClause } from '../../types/clauseAnalysis'
import { AnalysisSkeletonLayout } from './SkeletonLoader'

interface Props {
  result: AnalysisResponse | null
  isLoading: boolean
  clauseCount?: number
}

export default function ComplianceReport({ result, isLoading, clauseCount = 4 }: Props) {
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [categoryFilter, setCategoryFilter] = useState('All Categories')

  if (isLoading) return <AnalysisSkeletonLayout clauseCount={clauseCount} />
  if (!result) return null

  const sj = result.summary_json
  if (!sj) return null

  const { compliance_score, score_status, stats, agreement, clauses, category_breakdown, jurisdiction, critical_issue_ids } = sj

  // Recommendation from score
  const getRecommendation = (score: number) => {
    if (score >= 80) return { label: 'Approve', sub: 'Meets all requirements' }
    if (score >= 60) return { label: 'Conditional Approve', sub: `${critical_issue_ids.length} condition${critical_issue_ids.length !== 1 ? 's' : ''} required` }
    if (score >= 40) return { label: 'Needs Review', sub: 'Multiple issues found' }
    return { label: 'Reject', sub: 'Critical violations present' }
  }
  const recommendation = getRecommendation(compliance_score)

  // Issues to show
  const issues = clauses.filter(c => c.result !== 'MATCH')

  // Status label
  const getStatusLabel = (result: string) => {
    if (result === 'MATCH') return 'SATISFIES'
    if (result === 'VIOLATION') return 'VIOLATES'
    return 'RISKY'
  }

  const getBorderColor = (result: string) => {
    if (result === 'MATCH') return 'border-l-green-500'
    if (result === 'VIOLATION') return 'border-l-red-500'
    return 'border-l-amber-400'
  }

  const getStatusBadgeColor = (result: string) => {
    if (result === 'MATCH') return 'text-green-700'
    if (result === 'VIOLATION') return 'text-red-600'
    return 'text-amber-600'
  }

  // Filter clauses
  const categories = [...new Set(clauses.map(c => c.category))]
  const filteredClauses = clauses.filter(c => {
    const matchStatus = statusFilter === 'All Status' || getStatusLabel(c.result) === statusFilter
    const matchCategory = categoryFilter === 'All Categories' || c.category === categoryFilter
    return matchStatus && matchCategory
  })

  const catColors = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500']
  const catBgColors = ['bg-green-50', 'bg-blue-50', 'bg-purple-50', 'bg-pink-50', 'bg-orange-50', 'bg-teal-50']
  const catTextColors = ['text-green-600', 'text-blue-600', 'text-purple-600', 'text-pink-600', 'text-orange-600', 'text-teal-600']

  return (
    <div className="space-y-4">

      {/* ── Row 1: 3 top stat cards ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Compliance Score */}
        <div className="rounded-2xl p-5 border border-orange-100" style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #fdf2f8 100%)' }}>
          <div className="flex items-start justify-between mb-2">
            <span className="text-sm text-slate-500 font-medium">Compliance Score</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div className="text-4xl font-black text-slate-900">{compliance_score}%</div>
          <p className="text-xs text-slate-400 mt-1">Avg. Completed</p>
        </div>

        {/* Overall Verdict */}
        <div className="rounded-2xl p-5 border border-teal-100" style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%)' }}>
          <div className="flex items-start justify-between mb-2">
            <span className="text-sm text-slate-500 font-medium">Overall Verdict</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="text-2xl font-black text-slate-900 leading-tight">{score_status}</div>
          <div className="mt-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[11px] font-semibold uppercase tracking-wide">
              {score_status.replace(/\s+/g, '_').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200">
          <div className="flex items-start justify-between mb-2">
            <span className="text-sm text-slate-500 font-medium">Recommendation</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
          </div>
          <div className="text-2xl font-black text-slate-900 leading-tight">{recommendation.label}</div>
          <p className="text-xs text-slate-400 mt-1">{recommendation.sub}</p>
        </div>
      </div>

      {/* ── Row 2: 4 count cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon="doc" label="Total" count={stats.total} colorClass="bg-indigo-50 text-indigo-500" />
        <StatCard icon="check" label="Satisfies" count={stats.match} colorClass="bg-green-50 text-green-500" />
        <StatCard icon="x" label="Violates" count={stats.violation} colorClass="bg-red-50 text-red-500" />
        <StatCard icon="warn" label="Risky" count={stats.partial + stats.not_found} colorClass="bg-amber-50 text-amber-500" />
      </div>

      {/* ── Row 3: Executive Summary + Issues & Risks ── */}
      <div className="grid grid-cols-5 gap-4">

        {/* Executive Summary */}
        <div className="col-span-3 rounded-2xl p-5 bg-white border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-3">Executive Summary</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            {agreement
              ? <>
                  This <span className="text-slate-700 font-medium">{agreement.type}</span> between{' '}
                  <span className="text-slate-700 font-medium">{agreement.party_a}</span> and{' '}
                  <span className="text-slate-700 font-medium">{agreement.party_b}</span>,
                  dated {agreement.date} in {agreement.city}, {agreement.state}, has been analyzed against applicable compliance standards.{' '}
                </>
              : null
            }
            {stats.violation > 0
              ? `${stats.violation} violation${stats.violation !== 1 ? 's' : ''} and ${stats.partial + stats.not_found} risk item${stats.partial + stats.not_found !== 1 ? 's' : ''} require attention before execution.`
              : 'All clauses meet the required compliance standards.'
            }
          </p>
          {jurisdiction?.applicable_laws?.length > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Applicable Laws</p>
              <div className="flex flex-wrap gap-1.5">
                {jurisdiction.applicable_laws.map((law, i) => (
                  <span key={i} className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-xs text-slate-600">{law}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Issues & Risks */}
        <div className="col-span-2 rounded-2xl p-5 bg-white border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-3">Issues & Risks</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {issues.length === 0
              ? <p className="text-sm text-slate-400">No issues found.</p>
              : issues.map((clause, i) => <IssueCard key={i} clause={clause} />)
            }
          </div>
        </div>
      </div>

      {/* ── Row 4: Status Distribution + Category Scores ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Donut chart */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-4">Status Distribution</h3>
          <div className="flex items-center gap-8">
            <DonutChart
              total={stats.total}
              match={stats.match}
              violation={stats.violation}
              risky={stats.partial + stats.not_found}
            />
            <div className="space-y-2.5">
              <LegendItem color="bg-green-500" label="Satisfies" count={stats.match} />
              <LegendItem color="bg-red-500" label="Violates" count={stats.violation} />
              <LegendItem color="bg-amber-400" label="Risky" count={stats.partial + stats.not_found} />
            </div>
          </div>
        </div>

        {/* Category Scores */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-4">Category Scores</h3>
          <div className="space-y-3">
            {category_breakdown.map((cat, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 w-36 shrink-0 truncate">{cat.name}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${catColors[i % catColors.length]}`}
                    style={{ width: `${cat.pass_rate}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-slate-700 w-10 text-right">{cat.pass_rate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 5: Category Performance ── */}
      {category_breakdown.length > 0 && (
        <div className="rounded-2xl p-5 bg-white border border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Category Performance</h3>
          <p className="text-xs text-slate-400 mb-5">Score by policy category</p>
          <div className="space-y-5">
            {category_breakdown.map((cat, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={`h-9 w-9 rounded-xl ${catBgColors[i % catBgColors.length]} flex items-center justify-center flex-shrink-0`}>
                  <CategoryIcon index={i} className={catTextColors[i % catTextColors.length]} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-700">{cat.name}</span>
                    <span className="text-sm font-bold text-slate-900">{cat.pass_rate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${catColors[i % catColors.length]}`}
                      style={{ width: `${cat.pass_rate}%` }}
                    />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[11px] text-green-600">{cat.compliant} pass</span>
                    {cat.issues > 0 && <span className="text-[11px] text-red-500">{cat.issues} fail</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 6: Jurisdiction Checklist ── */}
      {jurisdiction?.checklist?.length > 0 && (
        <div className="rounded-2xl p-5 bg-white border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-1">Compliance Checklist</h3>
          <p className="text-xs text-slate-400 mb-4">{jurisdiction.jurisdiction} · {jurisdiction.agreement_type}</p>
          <div className="grid grid-cols-2 gap-2">
            {jurisdiction.checklist.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div className={`h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.required ? 'bg-indigo-100' : 'bg-slate-200'}`}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={item.required ? '#6366f1' : '#94a3b8'} strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-xs text-slate-600 leading-relaxed">{item.item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 7: All Clause Results ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">All Clause Results</h3>
            <p className="text-xs text-slate-400 mt-0.5">Showing {filteredClauses.length} of {clauses.length} clauses</p>
          </div>
          <div className="flex gap-2">
            <select
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 cursor-pointer"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option>All Status</option>
              <option>SATISFIES</option>
              <option>VIOLATES</option>
              <option>RISKY</option>
            </select>
            <select
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 cursor-pointer"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option>All Categories</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredClauses.map((clause, i) => (
            <div
              key={i}
              className={`rounded-xl bg-white border border-slate-200 border-l-4 ${getBorderColor(clause.result)} p-4`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <StatusIcon type={clause.result} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{clause.clause_title}</p>
                    <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{clause.reason}</p>
                    {clause.relevant_text && (
                      <p className="text-xs text-slate-400 mt-1.5">
                        <span className="font-medium text-slate-500">Reference:</span> {clause.relevant_text}
                      </p>
                    )}
                    {clause.ai_added_text && (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                        <p className="text-xs text-blue-700 leading-relaxed">
                          <span className="font-semibold">Recommendation:</span> {clause.ai_added_text}
                        </p>
                      </div>
                    )}
                    <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] text-slate-500">
                      {clause.category}
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-bold tracking-wide flex-shrink-0 mt-0.5 ${getStatusBadgeColor(clause.result)}`}>
                  {getStatusLabel(clause.result)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, count, colorClass }: { icon: string; label: string; count: number; colorClass: string }) {
  return (
    <div className="rounded-2xl p-5 bg-white border border-slate-200">
      <div className={`h-9 w-9 rounded-xl ${colorClass.split(' ')[0]} flex items-center justify-center mb-3`}>
        <StatIcon type={icon} className={colorClass.split(' ')[1]} />
      </div>
      <div className="text-3xl font-black text-slate-900">{count}</div>
      <div className="text-sm text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

function StatIcon({ type, className }: { type: string; className: string }) {
  if (type === 'doc') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  )
  if (type === 'check') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
  if (type === 'x') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────

function DonutChart({ total, match, violation, risky }: { total: number; match: number; violation: number; risky: number }) {
  const matchDeg = total > 0 ? (match / total) * 360 : 0
  const violateDeg = total > 0 ? (violation / total) * 360 : 0
  const m2 = matchDeg
  const v2 = matchDeg + violateDeg

  return (
    <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: total === 0
            ? '#e2e8f0'
            : `conic-gradient(#22c55e 0deg ${m2}deg, #ef4444 ${m2}deg ${v2}deg, #fbbf24 ${v2}deg 360deg)`,
        }}
      />
      {/* Inner hole */}
      <div className="absolute rounded-full bg-white" style={{ inset: '22%' }} />
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-slate-900">{total}</span>
        <span className="text-[10px] text-slate-400">Total</span>
      </div>
    </div>
  )
}

// ─── Legend Item ──────────────────────────────────────────────────────────────

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-3 w-3 rounded-full flex-shrink-0 ${color}`} />
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-900 ml-auto">{count}</span>
    </div>
  )
}

// ─── Status Icon ──────────────────────────────────────────────────────────────

function StatusIcon({ type }: { type: string }) {
  if (type === 'MATCH') return (
    <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  )
  if (type === 'VIOLATION') return (
    <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </div>
  )
  return (
    <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
  )
}

// ─── Issue Card (Issues & Risks panel) ───────────────────────────────────────

function IssueCard({ clause }: { clause: SummaryJsonClause }) {
  const isViolation = clause.result === 'VIOLATION'
  return (
    <div className={`rounded-xl p-3 border ${isViolation ? 'border-red-100 bg-red-50/40' : 'border-amber-100 bg-amber-50/40'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <StatusIcon type={clause.result} />
        <span className={`text-xs font-bold ${isViolation ? 'text-red-600' : 'text-amber-600'}`}>
          {isViolation ? 'Violation' : 'Risky'}
        </span>
      </div>
      <p className="text-sm font-semibold text-slate-800 leading-snug">{clause.clause_title}</p>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{clause.reason}</p>
      {clause.ai_added_text && (
        <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-100">
          <p className="text-xs text-blue-700 leading-relaxed">
            <span className="font-semibold">Tip:</span> {clause.ai_added_text}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Category Icon ────────────────────────────────────────────────────────────

function CategoryIcon({ index, className }: { index: number; className: string }) {
  const icons = [
    // Financial: dollar
    <svg key={0} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>,
    // Documentation: file
    <svg key={1} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>,
    // Compliance: shield
    <svg key={2} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>,
    // Other: clipboard
    <svg key={3} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>,
  ]
  return icons[index % icons.length]
}

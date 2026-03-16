import React from 'react'
import type { SummaryJson, ClauseResult } from '../../types/clauseAnalysis'

interface Props {
  data: SummaryJson
}

const getStatusColor = (result: ClauseResult) => {
  switch (result) {
    case 'MATCH': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'VIOLATION': return 'bg-red-100 text-red-800 border-red-200'
    case 'PARTIALLY_SATISFIED': return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'NOT_FOUND': return 'bg-blue-100 text-blue-800 border-blue-200'
    default: return 'bg-slate-100 text-slate-800 border-slate-200'
  }
}

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'HIGH': return 'bg-red-500'
    case 'MEDIUM': return 'bg-amber-500'
    case 'LOW': return 'bg-emerald-500'
    default: return 'bg-slate-500'
  }
}

export default function AnalysisDashboard({ data }: Props) {
  const {
    compliance_score,
    score_status,
    stats,
    agreement,
    category_breakdown,
    jurisdiction,
    timeline,
    clauses
  } = data

  return (
    <div className="bg-slate-50 min-h-screen pb-12 font-sans text-slate-900">
      
      {/* ── Header / Agreement Meta ── */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{agreement.type}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
              <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> {agreement.date}</span>
              <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> {agreement.city}, {agreement.state}</span>
              <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> {jurisdiction?.jurisdiction}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
               <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 uppercase tracking-wider">Party A: {agreement.party_a}</span>
               <span className="px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 text-xs font-bold border border-sky-100 uppercase tracking-wider">Party B: {agreement.party_b}</span>
            </div>
          </div>
          
          {/* Main Score KPI */}
          <div className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-200">
             <div className="relative h-16 w-16 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke={compliance_score >= 80 ? '#10b981' : compliance_score >= 50 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeDasharray={`${compliance_score} 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-slate-900 leading-none">{compliance_score}</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Compliance Score</div>
                <div className={`text-base font-bold ${compliance_score >= 80 ? 'text-emerald-600' : compliance_score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {score_status}
                </div>
              </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        
        {/* ── KPI Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="text-sm font-semibold text-slate-500 mb-1">Total Clauses Analyzed</div>
            <div className="text-3xl font-black text-slate-900">{stats.total}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-0"></div>
            <div className="text-sm font-semibold text-emerald-700 mb-1 z-10">Compliant Matches</div>
            <div className="text-3xl font-black text-emerald-600 z-10">{stats.match}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full -z-0"></div>
            <div className="text-sm font-semibold text-red-700 mb-1 z-10">Critical Violations</div>
            <div className="text-3xl font-black text-red-600 z-10">{stats.violation}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-bl-full -z-0"></div>
            <div className="text-sm font-semibold text-amber-700 mb-1 z-10">Partially Satisfied</div>
            <div className="text-3xl font-black text-amber-600 z-10">{stats.partial}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left Column: Breakdown & Jurisdiction ── */}
          <div className="lg:col-span-1 space-y-8">
            
            {/* Risk Category Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Risk Category Breakdown
              </h3>
              <div className="space-y-5">
                {category_breakdown.map((cat, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-end mb-1.5">
                      <div>
                        <div className="font-bold text-sm text-slate-800">{cat.name}</div>
                        <div className="text-[11px] font-medium text-slate-500">{cat.compliant} / {cat.total} Compliant • {cat.issues} Issues</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm text-white ${getRiskColor(cat.risk_level)}`}>{cat.risk_level} RISK</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                       <div className="bg-emerald-500 h-full" style={{ width: `${(cat.compliant/cat.total)*100}%` }}></div>
                       <div className="bg-red-500 h-full" style={{ width: `${(cat.issues/cat.total)*100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Compliance Checklist */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                Statutory Checklist
              </h3>
              <div className="space-y-3">
                {jurisdiction.checklist.map((item, idx) => (
                   <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                     <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center border ${item.required ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                        {item.required && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                     </div>
                     <div>
                       <div className={`text-sm font-medium ${item.required ? 'text-slate-900' : 'text-slate-600'}`}>{item.item}</div>
                       {!item.required && <div className="text-[10px] uppercase font-bold text-slate-400 mt-1">Recommended Option</div>}
                     </div>
                   </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── Right Column: Timeline & Clauses ── */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Key Dates Timeline */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Key Dates & Timeline
                </h3>
                <div className="relative border-l-2 border-slate-100 ml-4 space-y-6 pb-2">
                  {timeline.map((event, idx) => (
                    <div key={idx} className="relative pl-6">
                      <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-white"></div>
                      <div className="text-sm font-bold text-slate-900">{event.item.split('—')[0]?.trim()}</div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5 uppercase tracking-wide">
                        {event.clause_title} <span className="text-slate-300 mx-1">•</span> {event.item.split('—')[1]?.trim() || ''}
                      </div>
                    </div>
                  ))}
                </div>
            </div>

            {/* Detailed Clause List */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <h3 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Detailed Clause Analysis
               </h3>
               
               <div className="space-y-4">
                 {clauses.map((clause) => (
                   <div key={clause.clause_id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                     {/* Clause Header */}
                     <div className="bg-white px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                           <span className="text-xs font-black text-slate-400">#{clause.index}</span>
                           <h4 className="text-sm font-bold text-slate-900">{clause.clause_title}</h4>
                           {data.critical_issue_ids.includes(clause.clause_id) && (
                              <span className="px-2 py-0.5 text-[10px] font-black bg-red-100 text-red-700 rounded uppercase tracking-widest border border-red-200">Critical</span>
                           )}
                         </div>
                         <div className="text-xs text-slate-500 font-medium">Category: <span className="text-slate-700">{clause.category}</span></div>
                       </div>
                       <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap ${getStatusColor(clause.result)}`}>
                         {clause.result.replace('_', ' ')}
                       </div>
                     </div>

                     {/* Clause Body */}
                     <div className="px-5 py-4 space-y-4">
                       
                       {/* Reason */}
                       <div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Analysis Reason</div>
                         <p className="text-sm text-slate-800 font-medium">{clause.reason}</p>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Extracted Text */}
                          {clause.relevant_text && (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between">
                                Extracted Text 
                                <span className={`text-[10px] px-1.5 rounded-sm text-white ${getRiskColor(clause.risk_level)}`}>{clause.risk_level} RISK</span>
                              </div>
                              <p className="text-xs text-slate-600 font-serif leading-relaxed line-clamp-3 italic">"{clause.relevant_text}"</p>
                            </div>
                          )}

                          {/* AI Recommendation */}
                          {clause.ai_added_text && (
                            <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 shadow-sm">
                              <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1.5 flex gap-1 items-center">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                AI Recommendation
                              </div>
                              <p className="text-xs text-indigo-900 font-medium leading-relaxed">{clause.ai_added_text}</p>
                            </div>
                          )}
                       </div>

                       {/* Meta Footer */}
                       <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-slate-200/60 mt-2">
                         {clause.parties_obligated.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Obligated:</span>
                              <span className="text-xs font-semibold text-slate-700">{clause.parties_obligated.join(', ')}</span>
                            </div>
                         )}
                         <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Binding:</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold uppercase">{clause.binding_strength}</span>
                         </div>
                         {clause.missing_values.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-red-400 uppercase">Missing:</span>
                              <span className="text-xs font-semibold text-red-600">{clause.missing_values.join(', ')}</span>
                            </div>
                         )}
                       </div>

                     </div>
                   </div>
                 ))}
               </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

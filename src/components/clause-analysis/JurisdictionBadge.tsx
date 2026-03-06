import type { Jurisdiction } from '../../types/clauseAnalysis'

interface Props {
  jurisdiction: Jurisdiction
}

export default function JurisdictionBadge({ jurisdiction }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-0.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
        </svg>
        <span className="text-xs font-semibold text-indigo-700">{jurisdiction.jurisdiction}</span>
      </div>
      {jurisdiction.applicable_laws?.map((law) => (
        <span
          key={law}
          className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600"
        >
          {law}
        </span>
      ))}
    </div>
  )
}

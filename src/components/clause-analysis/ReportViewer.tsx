import { decodeBase64 } from '../../utils/base64'

interface Props {
  base64: string | undefined
  label?: string
}

export default function ReportViewer({ base64, label = 'report' }: Props) {
  if (!base64) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg className="text-slate-300 mb-3" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <p className="text-sm text-slate-400">No {label} available.</p>
      </div>
    )
  }

  const html = decodeBase64(base64)

  if (!html) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        Unable to decode {label} content.
      </p>
    )
  }

  return (
    <div
      className="prose prose-slate prose-sm max-w-none"
      style={{ fontFamily: 'sans-serif', lineHeight: 1.8, fontSize: '14px' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

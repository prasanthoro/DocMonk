import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

interface Props {
  file: File | null
  isParsing: boolean
  onDrop: (files: File[]) => void
  onRemove: () => void
}

export default function DocumentUploader({ file, isParsing, onDrop, onRemove }: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((accepted: File[]) => { if (accepted[0]) onDrop(accepted) }, [onDrop]),
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  })

  return (
    <div className="space-y-2.5">
      <div
        {...getRootProps()}
        className={[
          'rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all',
          isDragActive
            ? 'border-indigo-400 bg-indigo-50 scale-[1.01]'
            : file
            ? 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-400'
            : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60',
        ].join(' ')}
      >
        <input {...getInputProps()} />

        {isParsing ? (
          <div className="space-y-2.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 mx-auto">
              <svg className="animate-spin text-indigo-500" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 font-medium">Parsing document…</p>
            <p className="text-xs text-slate-400">This may take a moment</p>
          </div>
        ) : file ? (
          <FileUploaded file={file} onRemove={onRemove} />
        ) : (
          <DropPrompt isDragActive={isDragActive} />
        )}
      </div>

      {file && !isParsing && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Document ready for analysis
        </div>
      )}
    </div>
  )
}

function DropPrompt({ isDragActive }: { isDragActive: boolean }) {
  return (
    <div className="space-y-2">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl mx-auto transition ${
        isDragActive ? 'bg-indigo-200 text-indigo-600' : 'bg-indigo-100 text-indigo-500'
      }`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {isDragActive ? 'Drop your document here' : 'Drop or click to upload'}
      </p>
      <p className="text-xs text-slate-400">PDF · DOCX · DOC · TXT</p>
    </div>
  )
}

function FileUploaded({ file, onRemove }: { file: File; onRemove: () => void }) {
  const sizeKb = (file.size / 1024).toFixed(1)
  const ext = file.name.split('.').pop()?.toUpperCase() ?? ''

  const extColors: Record<string, string> = {
    PDF: 'bg-red-100 text-red-600',
    DOCX: 'bg-blue-100 text-blue-600',
    DOC: 'bg-blue-100 text-blue-600',
    TXT: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="space-y-2">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 mx-auto">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800 truncate max-w-[220px] mx-auto" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${extColors[ext] || 'bg-slate-100 text-slate-600'}`}>
            {ext}
          </span>
          <span className="text-xs text-slate-400">{sizeKb} KB</span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="text-xs text-red-500 hover:text-red-700 font-semibold transition hover:underline"
      >
        Remove file
      </button>
    </div>
  )
}

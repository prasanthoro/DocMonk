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
      'text/markdown': ['.md'],
    },
    maxFiles: 1,
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
        1. Upload Document
      </h2>

      <div
        {...getRootProps()}
        className={[
          'rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition',
          isDragActive
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50',
        ].join(' ')}
      >
        <input {...getInputProps()} />

        {isParsing ? (
          <div className="space-y-2">
            <SpinnerIcon className="animate-spin mx-auto text-indigo-500" />
            <p className="text-sm text-slate-500 font-medium">Parsing document…</p>
          </div>
        ) : file ? (
          <FileUploaded file={file} onRemove={onRemove} />
        ) : (
          <DropPrompt isDragActive={isDragActive} />
        )}
      </div>

      {file && (
        <p className="mt-2.5 text-xs text-emerald-600 font-medium flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Ready for analysis
        </p>
      )}
    </div>
  )
}

function DropPrompt({ isDragActive }: { isDragActive: boolean }) {
  return (
    <div className="space-y-2">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-500 mx-auto">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-600">
        {isDragActive ? 'Drop your document here' : 'Drop or click to upload'}
      </p>
      <p className="text-xs text-slate-400">PDF · DOCX · DOC · TXT · MD</p>
    </div>
  )
}

function FileUploaded({ file, onRemove }: { file: File; onRemove: () => void }) {
  const sizeKb = (file.size / 1024).toFixed(1)
  const ext = file.name.split('.').pop()?.toUpperCase()

  return (
    <div className="space-y-2">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 mx-auto">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 truncate max-w-[200px] mx-auto" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {ext} · {sizeKb} KB
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="text-xs text-red-500 hover:text-red-700 font-semibold transition"
      >
        Remove file
      </button>
    </div>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

import type { Clause, AnalysisResponse } from '../types/clauseAnalysis'
import { parseDocxToEditorJS } from '../components/editor/DocxParser'
import { analyzeDocument, validateClauses } from '../services/analyzeService'
import { slugify } from '../components/clause-analysis/ClauseRow'
import { parseDiffHtmlToBlocks } from '../utils/parseDiffHtmlToBlocks'
import { decodeBase64 } from '../utils/base64'

import DocumentUploader from '../components/clause-analysis/DocumentUploader'
import DocumentPreview from '../components/clause-analysis/DocumentPreview'
import ClauseForm from '../components/clause-analysis/ClauseForm'
import AnalysisResults from '../components/clause-analysis/AnalysisResults'

export const Route = createFileRoute('/analyze')({ component: AnalyzePage })

// ─── Default clause factory ──────────────────────────────────────────────────

function newClause(title = '', category: Clause['category'] = 'financial'): Clause {
  return { id: slugify(title) || uuidv4().slice(0, 8), title, category, value: '' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AnalyzePage() {
  // Document state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [editorData, setEditorData] = useState<any>(null)
  const [documentTitle, setDocumentTitle] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isReportMode, setIsReportMode] = useState(false)

  // Clause state
  const [clauses, setClauses] = useState<Clause[]>([newClause()])

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return

    setUploadedFile(file)
    setError(null)

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'docx' || ext === 'doc') {
      setIsParsing(true)
      try {
        const parsed = await parseDocxToEditorJS(file)
        setEditorData(parsed)
      } catch {
        setError('Failed to parse DOCX. The file may be corrupted or in an unsupported format.')
      } finally {
        setIsParsing(false)
      }
    }
  }, [])

  const handleFileRemove = useCallback(() => {
    setUploadedFile(null)
    setEditorData(null)
    setIsReportMode(false)
    setResult(null)
  }, [])

  // ── Clause CRUD ────────────────────────────────────────────────────────────

  const addClause = useCallback(() => {
    setClauses((prev) => {
      if (prev.length >= 100) return prev
      return [...prev, newClause()]
    })
  }, [])

  const updateClause = useCallback((id: string, field: keyof Clause, value: string) => {
    setClauses((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        return { ...c, [field]: value }
      })
    )
  }, [])

  const removeClause = useCallback((id: string) => {
    setClauses((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // ── Analysis ───────────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    setError(null)

    const validationError = validateClauses(clauses)
    if (validationError) { setError(validationError); return }

    if (!editorData?.blocks?.length && !uploadedFile) {
      setError('Please upload a document or type your contract in the editor.')
      return
    }

    setIsAnalyzing(true)
    setResult(null)

    try {
      const data = await analyzeDocument(uploadedFile, editorData, clauses)
      setResult(data)

      if (data.report_md_base64) {
        const html = decodeBase64(data.report_md_base64)
        const blocks = parseDiffHtmlToBlocks(html)
        if (blocks.length > 0) {
          setEditorData({ time: Date.now(), blocks, version: '2.31.4' })
          setIsReportMode(true)
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }


  return (
    <div className="min-h-screen bg-slate-50">

      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur px-6 py-3.5">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-slate-900">Clause Analysis</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a contract · add clauses · get AI-powered analysis
            </p>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || isParsing}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <SpinnerIcon />
                Analyzing…
              </>
            ) : (
              <>
                <AnalyzeIcon />
                Analyze Document
              </>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 flex items-center gap-3">
            <svg className="text-red-500 flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex flex-col xl:flex-row gap-5">

          <div className="xl:w-[380px] flex-shrink-0 space-y-5">
            <DocumentUploader
              file={uploadedFile}
              isParsing={isParsing}
              onDrop={handleFileDrop}
              onRemove={handleFileRemove}
            />
            <ClauseForm
              clauses={clauses}
              onAdd={addClause}
              onChange={updateClause}
              onRemove={removeClause}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-5">
            <DocumentPreview
              editorData={editorData}
              onChange={setEditorData}
              documentTitle={documentTitle}
              onTitleChange={setDocumentTitle}
              isReportMode={isReportMode}
            />


          </div>

          <AnalysisResults
            result={result}
            isLoading={isAnalyzing}
            clauseCount={clauses.filter((c) => c.title.trim()).length || 4}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Small icons ─────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  )
}

function AnalyzeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

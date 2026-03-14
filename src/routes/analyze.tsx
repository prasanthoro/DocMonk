import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { exportToTxt, exportToDocx, exportToPdf } from '../utils/exportUtils'


import type { Clause, AnalysisResponse } from '../types/clauseAnalysis'
import { parseDocxToEditorJS } from '../components/editor/DocxParser'
import { parsePdfToEditorJS } from '../utils/parsePdfToEditorJS'
import { parseTxtToEditorJS } from '../utils/parseTxtToEditorJS'
import { analyzeDocument, validateClauses } from '../services/analyzeService'
import { slugify } from '../components/clause-analysis/ClauseRow'
import { parseDiffHtmlToBlocks, parseDiffHtmlToAnalysisSummary } from '../utils/parseDiffHtmlToBlocks'
import { decodeBase64Async } from '../utils/base64'

import DocumentUploader from '../components/clause-analysis/DocumentUploader'
import ClauseForm from '../components/clause-analysis/ClauseForm'
import AnalysisResults from '../components/clause-analysis/AnalysisResults'

// Lazy-load DocumentPreview to prevent EditorJS SSR error
const DocumentPreview = lazy(() => import('../components/clause-analysis/DocumentPreview'))

export const Route = createFileRoute('/analyze')({
  component: () => <AnalyzePage />,
  // Disable SSR for this route to prevent EditorJS "Element is not defined" error
  // EditorJS is a browser-only library that can't be server-rendered
  staticData: { skipSsr: true },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newClause(title = '', category: Clause['category'] = 'financial'): Clause {
  return { id: slugify(title) || uuidv4().slice(0, 8), title, category, value: '' }
}

function getDecisionStats(data: any): { total: number; decided: number } {
  const blocks = Array.isArray(data?.blocks) ? data.blocks : []
  const diffBlocks = blocks.filter((b: any) => b?.type === 'diffBlock')
  const decided = diffBlocks.filter((b: any) => {
    const d = b?.data?.decision
    return d === 'approved' || d === 'rejected'
  }).length
  return { total: diffBlocks.length, decided }
}

function resolveDocumentFromDiff(data: any) {
  const blocks = Array.isArray(data?.blocks) ? data.blocks : []
  const resolvedBlocks: Array<{ type: string; data: Record<string, unknown> }> = []
  blocks.forEach((block: any) => {
    if (!block || typeof block !== 'object') return
    if (block.type !== 'diffBlock') { resolvedBlocks.push(block); return }
    const diffType = block?.data?.diffType
    const decision = block?.data?.decision
    const addedText = typeof block?.data?.addedText === 'string' ? block.data.addedText.trim() : ''
    const deletedText = typeof block?.data?.deletedText === 'string' ? block.data.deletedText.trim() : ''
    let finalText = ''
    if (diffType === 'new') {
      finalText = decision === 'approved' ? addedText : ''
    } else if (decision === 'approved') {
      finalText = addedText
    } else if (decision === 'rejected') {
      finalText = deletedText
    }
    if (finalText) resolvedBlocks.push({ type: 'paragraph', data: { text: finalText } })
  })
  return { time: Date.now(), blocks: resolvedBlocks, version: data?.version || '2.31.4' }
}

function editorDataToPlainText(data: any): string {
  return (Array.isArray(data?.blocks) ? data.blocks : [])
    .map((b: any) => {
      if (!b || typeof b !== 'object') return ''
      if (b.type === 'paragraph' || b.type === 'header') return String(b?.data?.text || '').trim()
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

function makeSafeFilename(name: string): string {
  return name.trim()
    .replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'document'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AnalyzePage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [editorData, setEditorData] = useState<any>(null)
  const [documentTitle, setDocumentTitle] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [isReportMode, setIsReportMode] = useState(false)

  const [clauses, setClauses] = useState<Clause[]>([newClause()])
  const [context, setContext] = useState('')

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [reportHtml, setReportHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'editor' | 'analysis'>('editor')
  const [isDiffParsing, setIsDiffParsing] = useState(false)
  const [hasPendingDiff, setHasPendingDiff] = useState(false)
  // Stores the decoded report HTML waiting to be parsed into diff blocks
  // — parsed lazily only when user clicks the Document tab
  const pendingDiffHtmlRef = useRef<string | null>(null)

  // Auto-switch to analysis tab when analysis starts or completes
  useEffect(() => {
    if (isAnalyzing || result) setRightTab('analysis')
  }, [isAnalyzing, result])

  const decisionStats = useMemo(() => getDecisionStats(editorData), [editorData])
  const canExport = isReportMode && decisionStats.total > 0 && decisionStats.total === decisionStats.decided

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
    } else if (ext === 'pdf') {
      setIsParsing(true)
      try {
        const parsed = await parsePdfToEditorJS(file)
        setEditorData(parsed)
      } catch {
        setError('Failed to extract text from PDF. The file may be scanned or password-protected.')
      } finally {
        setIsParsing(false)
      }
    } else if (ext === 'txt') {
      setIsParsing(true)
      try {
        const parsed = await parseTxtToEditorJS(file)
        setEditorData(parsed)
      } catch {
        setError('Failed to read TXT file.')
      } finally {
        setIsParsing(false)
      }
    }
  }, [])

  const handleFileRemove = useCallback(() => {
    setUploadedFile(null); setEditorData(null); setIsReportMode(false); setResult(null)
  }, [])

  // ── Clause CRUD ────────────────────────────────────────────────────────────

  const addClause = useCallback(() => {
    setClauses((prev) => prev.length >= 100 ? prev : [...prev, newClause()])
  }, [])

  const updateClause = useCallback((id: string, field: keyof Clause, value: string) => {
    setClauses((prev) => prev.map((c) => c.id !== id ? c : { ...c, [field]: value }))
  }, [])

  const removeClause = useCallback((id: string) => {
    setClauses((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const replaceClauses = useCallback((next: Clause[]) => setClauses(next), [])

  // ── Analysis ───────────────────────────────────────────────────────────────

  const handleAnalyze = useCallback(async () => {
    setError(null)
    const ve = validateClauses(clauses)
    if (ve) { setError(ve); return }
    if (!editorData?.blocks?.length && !uploadedFile) {
      setError('Please upload a document or type your contract in the editor.'); return
    }
    setIsAnalyzing(true); setResult(null)
    try {
      const data = await analyzeDocument(uploadedFile, editorData, clauses, context)

      let decodedHtml: string | null = null
      let enrichedData: AnalysisResponse = data

      if (data.report_md_base64) {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        decodedHtml = await decodeBase64Async(data.report_md_base64)

        if (decodedHtml && !data.analysis_summary?.length) {
          const parsedSummary = parseDiffHtmlToAnalysisSummary(decodedHtml)
          if (parsedSummary.length > 0) {
            enrichedData = { ...data, analysis_summary: parsedSummary }
          }
        }
      }

      setResult(enrichedData)
      setIsAnalyzing(false)

      if (decodedHtml) {
        setReportHtml(decodedHtml)
        // Store for lazy parsing — diff blocks only needed when user clicks Document tab
        pendingDiffHtmlRef.current = decodedHtml
        setHasPendingDiff(true)
      }
    } catch (err: any) {
      setError(err?.message || 'Analysis failed. Please try again.')
      setIsAnalyzing(false)
    }
  }, [clauses, editorData, uploadedFile, context])


  const handleExport = useCallback(async (format: 'txt' | 'docx' | 'pdf') => {
    if (!canExport) return

    // 1. Resolve the document based on approved/rejected changes
    // Only resolve the blocks, but DO NOT save it to editorData or hide the report
    // This allows the user to download multiple times!
    const resolved = resolveDocumentFromDiff(editorData)

    const txt = editorDataToPlainText(resolved)
    if (!txt) return

    // 2. Generate a safe filename
    const name = makeSafeFilename(documentTitle || uploadedFile?.name || 'updated-document')
    const finalName = `${name}-updated`

    // 3. Trigger requested export format
    switch (format) {
      case 'docx':
        await exportToDocx(txt, finalName);
        break;
      case 'pdf':
        exportToPdf(txt, finalName);
        break;
      default:
        exportToTxt(txt, finalName);
    }
  }, [canExport, editorData, documentTitle, uploadedFile])


  const handleTabChange = useCallback(async (tab: 'editor' | 'analysis') => {
    setRightTab(tab)
    // Lazily parse the diff blocks only when the user first opens the Document tab
    if (tab === 'editor' && pendingDiffHtmlRef.current && !isReportMode && !isDiffParsing) {
      const html = pendingDiffHtmlRef.current
      pendingDiffHtmlRef.current = null
      setIsDiffParsing(true)
      setHasPendingDiff(false)
      try {
        const blocks = await parseDiffHtmlToBlocks(html)
        if (blocks.length > 0) {
          setEditorData({ time: Date.now(), blocks, version: '2.31.4' })
        }
        setIsReportMode(true)
      } finally {
        setIsDiffParsing(false)
      }
    }
  }, [isReportMode, isDiffParsing])

  const handleReset = useCallback(() => {
    setResult(null); setIsReportMode(false)
    setEditorData(null); setUploadedFile(null)
    setReportHtml(null); setError(null); setRightTab('editor')
    pendingDiffHtmlRef.current = null; setHasPendingDiff(false)
    setClauses([newClause()]); setContext('')
  }, [])

  const handleCompleted = useCallback(() => {
    handleReset()
  }, [handleReset])

  const isReady = !!(uploadedFile || editorData?.blocks?.length)
  const validClauseCount = clauses.filter((c) => c.title.trim() && c.value.trim()).length

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-slate-200 bg-white z-20" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="max-w-[1600px] mx-auto px-5 h-14 flex items-center gap-3">

          <div className="flex items-center gap-2.5 mr-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900 leading-none">Clause Risk Analysis</p>
              <p className="text-[10px] text-slate-400 mt-0.5">AI-powered contract review</p>
            </div>
          </div>

          {/* Step pills */}
          <div className="hidden lg:flex items-center gap-1 flex-1">
            <StepPill n={1} label="Upload" done={!!uploadedFile} />
            <Arrow />
            <StepPill n={2} label="Clauses" done={validClauseCount > 0} count={validClauseCount || undefined} />
            <Arrow />
            <StepPill n={3} label="Context" done={!!context.trim()} optional />
            <Arrow />
            <StepPill n={4} label="Results" done={!!result} loading={isAnalyzing} />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 ml-auto">
            {result && !isAnalyzing && (
              <button onClick={handleReset} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
                New Analysis
              </button>
            )}

            {canExport && (
              <div className="flex items-center gap-1.5 bg-emerald-50 p-1 rounded-xl border border-emerald-100">
                <button
                  onClick={() => handleExport('txt')}
                  className="px-3 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                >
                  TXT
                </button>
                <div className="w-px h-3 bg-emerald-200" />
                <button
                  onClick={() => handleExport('docx')}
                  className="px-3 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                >
                  DOCX
                </button>
                <div className="w-px h-3 bg-emerald-200" />
                <button
                  onClick={() => handleExport('pdf')}
                  className="px-3 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                >
                  PDF
                </button>
              </div>
            )}

            {canExport && (
              <button
                onClick={handleCompleted}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                Completed
              </button>
            )}

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isParsing || !isReady}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Analyzing…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Run Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <div className="max-w-[1600px] mx-auto w-full flex gap-0 overflow-hidden">

          {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
          <aside className="w-[390px] flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">

            {/* Scrollable section: Upload + Clauses */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-3">

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 flex items-start gap-2">
                  <svg className="text-red-500 flex-shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-xs text-red-700 flex-1 leading-relaxed">{error}</p>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}

              {/* 1. Upload */}
              <SideCard step={1} title="Upload Document" done={!!uploadedFile}>
                <DocumentUploader
                  file={uploadedFile}
                  isParsing={isParsing}
                  onDrop={handleFileDrop}
                  onRemove={handleFileRemove}
                />
              </SideCard>

              {/* 2. Clauses */}
              <SideCard step={2} title="Define Clauses" done={validClauseCount > 0} badge={clauses.length > 0 ? `${clauses.length}` : undefined}>
                <ClauseForm
                  clauses={clauses}
                  onAdd={addClause}
                  onChange={updateClause}
                  onRemove={removeClause}
                  onClearAll={() => setClauses([newClause()])}
                  onReplace={replaceClauses}
                />
              </SideCard>

            </div>

            {/* ── Sticky context prompt at bottom ── */}
            <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${context.trim() ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                  {context.trim() ? (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : 3}
                </span>
                <span className={`text-xs font-bold flex-1 ${context.trim() ? 'text-emerald-800' : 'text-slate-700'}`}>
                  Analysis Context
                </span>
                <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Optional</span>
              </div>
              <ContextPrompt value={context} onChange={setContext} onSubmit={handleAnalyze} isLoading={isAnalyzing} />
            </div>

          </aside>

          {/* ── RIGHT CONTENT ───────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-slate-50">

            {/* Tab bar — visible once analysis starts */}
            {(result || isAnalyzing) && (
              <div className="flex-shrink-0 bg-white border-b border-slate-200 px-5 flex items-center gap-0">
                <button
                  onClick={() => handleTabChange('editor')}
                  className={`flex items-center gap-1.5 py-3 px-1 mr-6 text-sm font-semibold border-b-2 transition -mb-px ${rightTab === 'editor'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {isDiffParsing ? (
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  )}
                  Document
                  {(isReportMode || hasPendingDiff || isDiffParsing) && (
                    <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${rightTab === 'editor' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      {isDiffParsing ? '…' : 'Diff'}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTabChange('analysis')}
                  className={`flex items-center gap-1.5 py-3 px-1 text-sm font-semibold border-b-2 transition -mb-px ${rightTab === 'analysis'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Summary Analysis
                  {result?.analysis_summary?.length ? (
                    <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${rightTab === 'analysis' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                      {result.analysis_summary.length}
                    </span>
                  ) : null}
                </button>
              </div>
            )}

            {/* Document tab — always mounted to preserve EditorJS instance */}
            <div className={`flex-1 overflow-y-auto p-4 ${(result || isAnalyzing) && rightTab === 'analysis' ? 'hidden' : ''}`}>
              <Suspense fallback={<div className="text-sm text-slate-500">Loading document…</div>}>
                <DocumentPreview
                  editorData={editorData}
                  onChange={setEditorData}
                  documentTitle={documentTitle}
                  onTitleChange={setDocumentTitle}
                  isReportMode={isReportMode}
                  decisionStats={decisionStats}
                  reportHtml={reportHtml}
                />
              </Suspense>
            </div>

            {/* Analysis tab */}
            {rightTab === 'analysis' && (result || isAnalyzing) && (
              <div className="flex-1 overflow-y-auto p-4">
                <AnalysisResults
                  result={result}
                  isLoading={isAnalyzing}
                  clauseCount={clauses.filter((c) => c.title.trim()).length || 4}
                />
              </div>
            )}

          </main>

        </div>
      </div>
    </div>
  )
}

// ─── Side Card ────────────────────────────────────────────────────────────────

function SideCard({ step, title, children, done, optional, badge }: {
  step: number; title: string; children: React.ReactNode
  done?: boolean; optional?: boolean; badge?: string
}) {
  return (
    <div className="rounded-2xl border overflow-hidden transition-all" style={{
      borderColor: done ? '#d1fae5' : '#e2e8f0',
      boxShadow: done ? '0 1px 6px rgba(16,185,129,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b ${done ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50/70'}`}>
        <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
          {done ? (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : step}
        </span>
        <span className={`text-xs font-bold flex-1 ${done ? 'text-emerald-800' : 'text-slate-700'}`}>{title}</span>
        {optional && <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Optional</span>}
        {badge && <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">{badge}</span>}
      </div>
      <div className="p-3.5 bg-white">{children}</div>
    </div>
  )
}

// ─── Step Pill ────────────────────────────────────────────────────────────────

function StepPill({ n, label, done, loading, optional, count }: {
  n: number; label: string; done?: boolean; loading?: boolean; optional?: boolean; count?: number
}) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${loading ? 'bg-indigo-50 text-indigo-600' :
      done ? 'bg-emerald-50 text-emerald-700' :
        'bg-slate-100 text-slate-400'
      }`}>
      <span className={`h-3.5 w-3.5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 ${loading ? 'bg-indigo-500 text-white' :
        done ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'
        }`}>
        {loading ? '…' : done ? '✓' : n}
      </span>
      {label}
      {count !== undefined && count > 0 && (
        <span className="bg-indigo-600 text-white rounded-full px-1.5 text-[9px] font-black leading-tight py-0.5">{count}</span>
      )}
      {optional && !done && <span className="opacity-50 text-[9px]">(opt)</span>}
    </div>
  )
}

function Arrow() {
  return (
    <svg className="text-slate-300 flex-shrink-0" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// ─── ChatGPT-style Context Prompt ────────────────────────────────────────────

const QUICK_PROMPTS = [
  'Analyze for tenant risks in a commercial lease agreement.',
  'Focus on financial penalties, late fees, and payment terms.',
  'Check for clauses that strongly favor the other party.',
  'Identify any missing clauses required under Indian contract law.',
]

function ContextPrompt({ value, onChange, onSubmit, isLoading }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; isLoading: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Guide the AI with your role, jurisdiction, or risk focus. Press <kbd className="text-[10px] bg-slate-100 border border-slate-200 rounded px-1 py-0.5 font-mono">Enter</kbd> to run, <kbd className="text-[10px] bg-slate-100 border border-slate-200 rounded px-1 py-0.5 font-mono">Shift+Enter</kbd> for new line.
      </p>

      {/* Chat-style input box */}
      <div className={`relative rounded-2xl border-2 transition-all duration-150 ${value.trim()
        ? 'border-indigo-300 shadow-md shadow-indigo-100/60 bg-white'
        : 'border-slate-200 bg-white hover:border-slate-300'
        }`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. This is a commercial lease in India. I'm the tenant. Please focus on financial risks, security deposits, and penalty clauses…"
          className="w-full resize-none bg-transparent border-none outline-none px-4 pt-3.5 pb-11 text-sm text-slate-800 placeholder-slate-400 leading-relaxed"
          style={{ minHeight: '84px', maxHeight: '160px' }}
        />

        {/* Bottom action bar */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between border-t border-slate-100/80">
          <div className="flex items-center gap-1.5">
            {value.trim() && (
              <>
                <span className="text-[10px] text-slate-400 tabular-nums">{value.trim().length}</span>
                <button
                  onClick={() => onChange('')}
                  className="text-[11px] text-slate-400 hover:text-red-500 font-medium transition"
                >
                  × Clear
                </button>
              </>
            )}
          </div>
          <button
            onClick={onSubmit}
            disabled={isLoading}
            title={value.trim() ? 'Run analysis (Enter)' : 'Add context above, then run analysis'}
            className={`h-7 w-7 rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm ${value.trim() && !isLoading
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
          >
            {isLoading ? (
              <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Quick prompts — only when empty */}
      {!value.trim() && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Quick prompts</p>
          <div className="flex flex-col gap-1">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => onChange(p)}
                className="text-left text-[11px] text-slate-500 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700 transition leading-snug"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

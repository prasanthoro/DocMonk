# DocMonk — Project Reference

## Overview
AI-powered contract clause analysis tool. Users upload a document, define clauses to check, optionally add context, then run analysis. The AI checks each clause against the document and returns results.

## Tech Stack
- React + TypeScript, TanStack Router, Tailwind CSS
- EditorJS (custom tools: DiffBlockTool, headers, tables, etc.)
- Backend API at `VITE_API_URL` or `https://docmonk-production.up.railway.app`

---

## File Structure (key files)
```
src/
  routes/
    analyze.tsx           ← Main page — all state, layout, and orchestration
  components/
    clause-analysis/
      AnalysisResults.tsx     ← Summary Analysis tab content (clause cards + markdown summary)
      ClauseResultCard.tsx    ← Individual clause result card (expandable)
      ClauseForm.tsx          ← Left sidebar clause input/management
      DocumentPreview.tsx     ← Right panel document container (wraps EditorComponent)
      DocumentUploader.tsx    ← File drag-and-drop upload
    editor/
      EditorComponent.tsx     ← EditorJS wrapper with visibility-deferred rendering
      DiffBlockTool.ts        ← Custom EditorJS block: shows Accept/Reject UI for diff changes
      tools.ts                ← Registers all EditorJS tools
  services/
    analyzeService.ts         ← API call to /v1/analyze endpoint
  types/
    clauseAnalysis.ts         ← All TypeScript interfaces (Clause, ClauseAnalysis, AnalysisResponse, etc.)
  utils/
    parseDiffHtmlToBlocks.ts  ← Parses diff HTML from API into EditorJS block array
    base64.ts                 ← encode/decode helpers (sync and async)
    markdownToHtml.ts         ← Markdown → HTML for summary panel
```

---

## State in analyze.tsx (key state vars)
| State | Purpose |
|---|---|
| `uploadedFile` | The uploaded File object |
| `editorData` | EditorJS block data (original doc OR diff blocks after analysis) |
| `isAnalyzing` | True while API call is in flight — controls skeleton loader in Summary tab |
| `result` | Full API response (AnalysisResponse) |
| `reportHtml` | Decoded HTML from `result.report_md_base64` (fallback iframe) |
| `isReportMode` | True after analysis completes with diff data |
| `rightTab` | `'editor'` or `'analysis'` — controls which right panel is visible |
| `decisionStats` | `{ total, decided }` — computed from editorData diffBlocks |
| `canExport` | True when all diffs are decided and in report mode |

---

## API Response Shape (AnalysisResponse)
```typescript
{
  status: string
  analysis_summary: ClauseAnalysis[]   // Per-clause results shown in Summary tab
  conflicts?: Conflict[]
  jurisdiction?: { jurisdiction: string; applicable_laws?: string[] }
  report_md_base64?: string            // Base64 diff report HTML → parsed into DiffBlocks
  summary_md_base64?: string           // Base64 markdown summary → shown in SummaryPanel
}

// Per-clause result
ClauseAnalysis {
  clause_id, clause_title, clause_content
  result: 'MATCH' | 'VIOLATION' | 'NOT_FOUND' | 'PARTIALLY_SATISFIED'
  reason, relevant_text, ai_added_text
  parties_obligated, missing_values, binding_strength, key_dates_durations
}
```

---

## Analysis Flow (handleAnalyze in analyze.tsx)
1. `setIsAnalyzing(true)`, `setResult(null)` — start loading
2. Call `analyzeDocument(file, editorData, clauses, context)` — POST to `/v1/analyze`
3. `setResult(data)` — API response stored (Summary tab can now render)
4. **`setIsAnalyzing(false)`** — Summary tab exits skeleton, shows results immediately
5. If `data.report_md_base64`:
   - Decode HTML with `decodeBase64Async`
   - `setReportHtml(html)` — iframe fallback
   - Parse HTML into EditorJS blocks with `parseDiffHtmlToBlocks`
   - `setEditorData({ blocks: diffBlocks })` — REPLACES original doc with diff blocks in editor
   - `setIsReportMode(true)` — enables diff review mode
6. `finally: setIsAnalyzing(false)` — no-op if already false, handles error case

### Tab Auto-switch
```js
useEffect(() => {
  if (isAnalyzing || result) setRightTab('analysis')
}, [isAnalyzing, result])
```
Switches to Summary Analysis tab when analysis starts or result arrives.

---

## Two-Panel Layout
- **Left sidebar (390px)**: DocumentUploader + ClauseForm + ContextPrompt
- **Right content**: Tab bar (Document | Summary Analysis)
  - **Document tab**: Always mounted (hidden via CSS when analysis tab active), shows EditorComponent
  - **Summary Analysis tab**: Conditionally rendered, shows AnalysisResults component

### Hidden vs Unmounted
The Document tab div uses `className="... hidden"` (NOT unmounted) to preserve EditorJS state.
The Summary Analysis tab is conditionally rendered (mounts/unmounts on tab switch).

---

## DiffBlockTool (Accept/Reject)
Each DiffBlock in the editor represents an AI-suggested text change.

```typescript
DiffBlockData {
  diffType: 'modified' | 'partial' | 'new'
  deletedText: string   // original text
  addedText: string     // AI-suggested text
  reason?: string       // why AI made this change
  decision: 'approved' | 'rejected' | null
}
```
- Undecided: shows both deleted (red strikethrough) and added (green) with Accept/Reject buttons
- Approved: shows only added text, green border
- Rejected: shows only original text, gray border/opacity
- Dispatches `'diff-decision-change'` CustomEvent → EditorComponent saves → `setEditorData` called → `decisionStats` recalculates

### parseDiffHtmlToBlocks
- `.diff-group[data-type="unchanged"]` → `paragraph` block
- `.diff-group[data-type="modified|partial|new"]` → `diffBlock`

---

## EditorComponent: Visibility-Deferred Rendering
When `setEditorData` is called while the editor container is hidden (user is on Summary tab),
EditorComponent polls every 200ms until the container becomes visible, then renders.
This prevents UI freezes from heavy EditorJS rendering while user is on Summary tab.

---

## Export Flow
- `canExport = isReportMode && decisionStats.total > 0 && decisionStats.total === decisionStats.decided`
- `resolveDocumentFromDiff(editorData)` applies decisions to produce final document
- Exported as `.txt` file

---

## Known Bug Fixes Applied

### Fix 1: Summary tab skeleton never cleared (main bug)
**Problem**: `isAnalyzing` stayed `true` during diff HTML processing (decode + parse), which happens
AFTER the API call. `setIsAnalyzing(false)` was only in `finally`, so the Summary tab showed
skeleton throughout all diff processing even though the API data was ready.

**Fix**: Call `setIsAnalyzing(false)` immediately after `setResult(data)`, before diff processing.
`finally` still calls `setIsAnalyzing(false)` as safety net for error cases.

### Document Accept/Reject behavior (by design)
The DiffBlocks with Accept/Reject buttons in the Document tab ARE intended behavior.
After analysis, the editor content is replaced with diff blocks so the user can review changes.
The Summary tab shows clause-level analysis (MATCH/VIOLATION/etc.), not the diff review.

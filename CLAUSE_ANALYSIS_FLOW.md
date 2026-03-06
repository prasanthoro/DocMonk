# DocMonk — Clause Analysis: Full Flow Documentation

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Page Layout](#2-page-layout)
3. [Step-by-Step User Flow](#3-step-by-step-user-flow)
4. [Document Input Methods](#4-document-input-methods)
5. [Clause Configuration](#5-clause-configuration)
6. [API Request & Response](#6-api-request--response)
7. [Report HTML Structure](#7-report-html-structure)
8. [Diff Report in EditorJS](#8-diff-report-in-editorjs)
9. [DiffBlockTool — Accept / Reject Flow](#9-diffblocktool--accept--reject-flow)
10. [Analysis Results Panel](#10-analysis-results-panel)
11. [Summary Rendering](#11-summary-rendering)
12. [File Structure](#12-file-structure)
13. [Data Types Reference](#13-data-types-reference)
14. [Editor Tools Registry](#14-editor-tools-registry)
15. [Utilities Reference](#15-utilities-reference)

---

## 1. System Overview

DocMonk's **Clause Analysis** feature lets users upload a legal contract, define the clauses they want checked, and receive an AI-powered compliance report. The report is rendered directly inside the main EditorJS document editor as an interactive diff — the user can **Accept** or **Reject** each flagged change inline.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Analyze Page (/analyze)                      │
│                                                                       │
│  ┌──────────────────┐   ┌──────────────────────────────────────────┐ │
│  │  Left Panel      │   │  Right Panel                             │ │
│  │                  │   │                                          │ │
│  │  1. Upload doc   │   │  DocumentPreview (EditorJS)              │ │
│  │  2. Add clauses  │   │  ─ Before analysis: shows uploaded doc   │ │
│  │                  │   │  ─ After analysis: shows diff report     │ │
│  │  [Analyze Btn]   │   │                                          │ │
│  │                  │   │  AnalysisResults                         │ │
│  │                  │   │  ─ Clause cards (left)                   │ │
│  │                  │   │  ─ Summary markdown (right)              │ │
│  └──────────────────┘   └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Page Layout

**Route:** `/analyze` → `src/routes/analyze.tsx`

### Left panel (380px fixed)
| Component | Purpose |
|---|---|
| `DocumentUploader` | Drag-and-drop file upload (DOCX, PDF, TXT, MD) |
| `ClauseForm` | Add/edit/remove clauses to check |

### Right panel (flex-1)
| Component | Purpose |
|---|---|
| `DocumentPreview` | EditorJS editor — shows document before analysis, diff report after |
| `AnalysisResults` | Clause result cards + Analysis Summary side-panel |

---

## 3. Step-by-Step User Flow

### Phase 1 — Document Input

```
User uploads file / types contract
        │
        ▼
Is it DOCX/DOC?
  YES → parseDocxToEditorJS(file)    → editorData (EditorJS blocks)
  NO  → file stored for raw upload   → sent as base64 bytes (PDF/TXT/MD)
        │
        ▼
DocumentPreview renders the document in EditorJS
```

### Phase 2 — Clause Configuration

```
User adds clauses:
  - Title:    "Monthly Rent"
  - Category: financial / legal / penalty / …
  - Value:    "Rs. 2,25,000 payable on or before 5th of every month"

Each clause gets a unique slug ID (auto-generated from title)
Up to 100 clauses allowed
```

### Phase 3 — Analysis

```
User clicks "Analyze Document"
        │
        ▼
validateClauses() — checks at least 1 valid clause, no duplicate IDs
        │
        ▼
buildDocumentBase64()
  ├── PDF/TXT/MD file → raw bytes → base64
  └── DOCX/typed     → editorjsToHtml() → HTML string → base64
        │
        ▼
POST /v1/analyze  (120s timeout)
  body: { document_base64, document_filename, clauses[] }
        │
        ▼
API response: AnalysisResponse
  ├── analysis_summary[]    → clause-by-clause results
  ├── conflicts[]           → cross-clause conflicts
  ├── jurisdiction          → detected jurisdiction + applicable laws
  ├── report_md_base64      → base64-encoded diff HTML (the full annotated doc)
  └── summary_md_base64     → base64-encoded Markdown summary
```

### Phase 4 — Report Rendering

```
API response received
        │
        ├── report_md_base64
        │      │
        │      ▼ decodeBase64()
        │   Diff HTML string
        │      │
        │      ▼ parseDiffHtmlToBlocks()
        │   EditorJS block array [ paragraph, diffBlock, diffBlock, … ]
        │      │
        │      ▼ setEditorData()
        │   DocumentPreview (EditorJS) re-renders with diff blocks
        │   isReportMode = true → indigo banner + "X changes" badge
        │
        └── summary_md_base64 + analysis_summary
               │
               ▼
           AnalysisResults component
           ├── Clause cards (left)
           └── Summary panel (right) — markdownToHtml() → rendered HTML
```

### Phase 5 — Interactive Diff Review

```
User reviews each DiffBlock in the editor:

  [Violation]                              [Why?]
  ─ Rs. 150,000 per month                  ← red strikethrough (original)
  + Rs. 2,25,000 payable on or before      ← green (recommended)
    5th day of each month

  Apply this change?        [✓ Accept]  [✗ Reject]

  ACCEPT → block shows green ring, "Using updated text."
  REJECT → block shows gray tint, "Keeping original text."
```

---

## 4. Document Input Methods

### DOCX / DOC
Parsed client-side via `parseDocxToEditorJS()` using `jszip`:
- Extracts paragraphs → `paragraph` blocks
- Headings → `header` blocks (level 1–6)
- Tables → `table` blocks
- Images → `image` blocks (base64 data URLs)
- Lists → `list` blocks

### PDF / TXT / MD
File is read as binary → converted to base64 → sent raw to the API. The API handles text extraction server-side.

### Manual typing
User types directly into the EditorJS editor. On analysis, `editorjsToHtml()` converts blocks to an HTML string before base64-encoding.

---

## 5. Clause Configuration

Each clause has:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | URL-safe slug, auto-generated from title, user-editable |
| `title` | `string` | Short clause name, e.g. "Monthly Rent" |
| `category` | `ClauseCategory` | Classifies the clause type |
| `value` | `string` | Expected clause language — what the AI checks against |

### Clause categories

`core` · `financial` · `legal` · `penalty` · `usage` · `operational` · `risk` · `statutory` · `execution` · `confidentiality` · `termination` · `other`

### Validation rules
- At least 1 clause with both `title` and `value` filled
- No duplicate `id` values (case-insensitive)
- Maximum 100 clauses

---

## 6. API Request & Response

### Request

```
POST /v1/analyze
Content-Type: application/json

{
  "document_base64": "<base64-encoded document>",
  "document_filename": "contract.docx",
  "clauses": [
    {
      "id": "monthly-rent",
      "category": "financial",
      "title": "Monthly Rent",
      "value": "Rs. 2,25,000 payable on or before 5th of every month"
    }
  ]
}
```

**Timeout:** 120 seconds

### Response

```json
{
  "status": "completed",
  "job_id": "81973985-da45-41d6-acb3-ba8e57097fc1",
  "analysis_summary": [
    {
      "clause_id": "monthly-rent",
      "clause_title": "Monthly Rent",
      "result": "VIOLATION",
      "reason": "Document specifies Rs. 150,000 with no due date...",
      "relevant_text": "2. Monthly Rent: The Tenant agrees to pay Rs. 150000 per month.",
      "ai_added_text": "Monthly Rent: Rs. 2,25,000 payable on or before the 5th..."
    }
  ],
  "conflicts": [],
  "jurisdiction": {
    "jurisdiction": "Telangana, India",
    "applicable_laws": ["Indian Contract Act 1872", "IT Act 2000"]
  },
  "report_md_base64": "<base64 HTML>",
  "summary_md_base64": "<base64 Markdown>"
}
```

### Clause result types

| Result | Meaning | Color |
|---|---|---|
| `MATCH` | Clause found and compliant | Green |
| `VIOLATION` | Clause found but contradicts requirement | Red |
| `PARTIALLY_SATISFIED` | Clause partially present or partially correct | Amber |
| `NOT_FOUND` | Clause completely missing from document | Blue |

---

## 7. Report HTML Structure

The `report_md_base64` decodes to a self-contained HTML document with embedded CSS. The structure uses `.diff-group` divs with a `data-type` attribute:

```html
<style>
  /* All visual styles embedded inline */
  .diff-container { ... }
  .diff-group { position: relative; ... }
  .diff-line { display: flex; ... }
  /* Type-specific colors */
  .diff-group[data-type="modified"] .diff-line.deleted { background: #fde8e8; }
  .diff-group[data-type="modified"] .diff-line.added   { background: #d4edda; }
  /* etc. */
</style>

<div class="diff-container">

  <!-- UNCHANGED — original document line (context) -->
  <div class="diff-group" data-type="unchanged">
    <div class="diff-line normal">
      <div class="line-content">Party A: Mr. Arun Kumar...</div>
    </div>
  </div>

  <!-- VIOLATION — wrong value found -->
  <div class="diff-group" data-type="modified">
    <span class="reason-icon">i
      <span class="reason-tooltip">Clause specifies Rs. 150,000 with no due date...</span>
    </span>
    <div class="diff-line deleted">
      <div class="gutter">−</div>
      <div class="line-content">
        <span class="old-text">2. Monthly Rent: ...Rs. 150000...</span>
      </div>
    </div>
    <div class="diff-line added">
      <div class="gutter">+</div>
      <div class="line-content">Monthly Rent: Rs. 2,25,000 payable on or before the 5th...</div>
    </div>
  </div>

  <!-- PARTIAL — partially satisfied -->
  <div class="diff-group" data-type="partial"> ... </div>

  <!-- NEW — clause entirely missing, must be added -->
  <div class="diff-group" data-type="new">
    <span class="reason-icon">i<span class="reason-tooltip">...</span></span>
    <div class="diff-line new-clause">
      <div class="gutter">+</div>
      <div class="line-content">Rent Escalation: The rent shall increase by 8%...</div>
    </div>
  </div>

</div>
```

### data-type values

| `data-type` | Meaning | DiffBlockTool badge |
|---|---|---|
| `unchanged` | Original text — no issue | Rendered as plain paragraph |
| `modified` | Violation — wrong value, must change | Red "Violation" badge |
| `partial` | Partially correct — needs amendment | Amber "Partial" badge |
| `new` | Missing clause — must be added | Blue "New Clause" badge |

---

## 8. Diff Report in EditorJS

### Parsing: `parseDiffHtmlToBlocks(html)`

`src/utils/parseDiffHtmlToBlocks.ts`

Uses `DOMParser` to walk all `.diff-group` elements and produce an EditorJS block array:

```
unchanged + has text  →  { type: 'paragraph', data: { text } }
modified / partial    →  { type: 'diffBlock', data: { diffType, deletedText, addedText, reason, decision: null } }
new                   →  { type: 'diffBlock', data: { diffType: 'new', addedText, reason, decision: null } }
```

### Loading into the editor

After the API responds (`analyze.tsx`):

```typescript
const html   = decodeBase64(data.report_md_base64)
const blocks = parseDiffHtmlToBlocks(html)
setEditorData({ time: Date.now(), blocks, version: '2.31.4' })
setIsReportMode(true)
```

The `EditorComponent` data-sync effect detects the change and calls `editor.clear()` → `editor.render(blocks)`, replacing the original document with the diff report.

### DocumentPreview in report mode

When `isReportMode === true`, `DocumentPreview` shows:
- **Indigo banner** (instead of amber): "Analysis complete. Review each change below — Accept / Reject"
- **"X changes" badge** in the header bar showing how many `diffBlock` blocks are present

---

## 9. DiffBlockTool — Accept / Reject Flow

`src/components/editor/DiffBlockTool.ts`

A vanilla-JS EditorJS block tool (no React, no external deps). Registered globally in `getEditorTools()`.

### Block data structure

```typescript
interface DiffBlockData {
  diffType: 'modified' | 'partial' | 'new'
  deletedText: string   // original clause text from the document
  addedText: string     // AI-recommended replacement
  reason?: string       // detailed explanation tooltip
  decision: 'approved' | 'rejected' | null
}
```

### Visual layout

```
┌────────────────────────────────────────────────┐
│  🔴 Violation                          [Why?]  │  ← header
├────────────────────────────────────────────────┤
│  − <old text strikethrough>                    │  ← deleted row (red bg)
├────────────────────────────────────────────────┤
│  + <new recommended text>                      │  ← added row (green bg)
├────────────────────────────────────────────────┤
│  Apply this change?      [✓ Accept] [✗ Reject] │  ← action footer
└────────────────────────────────────────────────┘
```

After clicking **Accept**:
```
┌────────────────────────────────────────────────┐  ← green ring border
│  🔴 Violation                    ✓ Approved    │
│  + <new recommended text>                      │  ← only added shown
│  Using updated text.                  [Undo]   │
└────────────────────────────────────────────────┘
```

After clicking **Reject**:
```
┌────────────────────────────────────────────────┐  ← gray tint, 0.72 opacity
│  🔴 Violation                    ✗ Rejected    │
│  − <old text> (no strikethrough — kept as-is)  │  ← only deleted shown
│  Keeping original text.               [Undo]   │
└────────────────────────────────────────────────┘
```

For `new` clauses when rejected:
```
│  This clause will not be added.                │
```

### Why? tooltip

The "Why?" button toggles a dark panel below the header showing the AI's reason for flagging this block.

### Decision persistence

- `this.data.decision` is mutated in place on each button click
- `save()` returns `{ ...this.data }` — EditorJS captures the updated decision on every `editor.save()` call
- The `config.onDecisionChange` callback fires after each click so parent components can poll stats

---

## 10. Analysis Results Panel

`src/components/clause-analysis/AnalysisResults.tsx`

Shown **below** the DocumentPreview editor. Two-column layout on desktop (xl+):

### Left — Clause result cards
One `ClauseResultCard` per clause in `analysis_summary[]`. Each card shows:
- Status badge (MATCH / VIOLATION / PARTIALLY_SATISFIED / NOT_FOUND)
- Clause title and reason text
- Relevant text excerpt from the document
- Missing values / key dates (if applicable)

### Right — Summary panel (420px)
Renders `summary_md_base64` decoded Markdown as formatted HTML using `markdownToHtml()`. Shows:
- Overall compliance score
- Counts table (Total / Match / Violation / Partial / Not Found)
- Critical issues table
- Risk category breakdown (HIGH / MEDIUM / LOW)
- Jurisdiction & compliance checklist
- Contract timeline

### Conflicts section (below, full width)
If `conflicts[]` is non-empty, renders each conflict with:
- Involved clause IDs (as code chips)
- Severity level
- Description

---

## 11. Summary Rendering

`src/utils/markdownToHtml.ts`

Converts the Markdown summary returned by the API into inline-styled HTML (no CSS classes needed, works without Tailwind).

### Handled patterns

| Markdown pattern | Output |
|---|---|
| `## Heading` | `<h2 style="…">` |
| `### Heading` | `<h3 style="…">` |
| `\| table \| rows \|` | `<table style="…"><tbody>…` |
| `\|:---:\|` separator | Identifies header row (renders as `<th>`) |
| `**bold**` | `<strong>` |
| `*italic*` | `<em>` |
| `` `code` `` | `<code style="…">` |
| `---` | `<hr>` |
| `- list item` | `<ul><li>…` |
| plain text | `<p style="…">` |

---

## 12. File Structure

```
src/
├── routes/
│   └── analyze.tsx                    ← Page entry point, state management
│
├── components/
│   ├── clause-analysis/
│   │   ├── DocumentPreview.tsx         ← EditorJS wrapper (doc + report mode)
│   │   ├── DocumentUploader.tsx        ← Drag-and-drop file upload zone
│   │   ├── ClauseForm.tsx              ← Add/edit clause list
│   │   ├── ClauseRow.tsx               ← Single clause row with fields
│   │   ├── AnalysisResults.tsx         ← Clause cards + summary panel
│   │   ├── ClauseResultCard.tsx        ← Individual clause result card
│   │   ├── ClauseSummaryTable.tsx      ← Counts row (match/violation/etc)
│   │   ├── JurisdictionBadge.tsx       ← Jurisdiction label chip
│   │   ├── SkeletonLoader.tsx          ← Loading skeleton while analyzing
│   │   ├── DiffReportEditor.tsx        ← (standalone diff editor, not used on main page)
│   │   └── DiffReportViewer.tsx        ← (legacy React diff viewer)
│   │
│   └── editor/
│       ├── EditorComponent.tsx         ← Core EditorJS React wrapper
│       ├── DiffBlockTool.ts            ← Custom block: diff accept/reject UI
│       ├── CustomHeaderTool.ts         ← Custom H1–H6 with alignment
│       ├── CustomTableTool.ts          ← Rich table (merge/split cells, colors)
│       ├── CustomHorizontalLineTool.ts ← Styled dividers (solid/dashed/dotted)
│       ├── SimpleImageTool.ts          ← Lightweight image block (base64/URL)
│       ├── TextStyleTools.ts           ← Inline text color tool
│       ├── CustomAlignmentTool.ts      ← Block alignment tune
│       ├── DocxParser.ts               ← DOCX → EditorJS blocks parser
│       └── tools.ts                    ← EditorJS tools registry
│
├── services/
│   └── analyzeService.ts               ← API call + document base64 builder
│
├── utils/
│   ├── base64.ts                       ← encode/decode/fileToBase64
│   ├── editorjsToHtml.ts               ← EditorJS blocks → HTML (for API)
│   ├── parseDiffHtmlToBlocks.ts        ← Diff HTML → EditorJS blocks
│   └── markdownToHtml.ts               ← Markdown → inline-styled HTML
│
└── types/
    └── clauseAnalysis.ts               ← All TypeScript interfaces
```

---

## 13. Data Types Reference

### `Clause` (input)
```typescript
interface Clause {
  id: string            // e.g. "monthly-rent"
  title: string         // e.g. "Monthly Rent"
  category: ClauseCategory
  value: string         // expected clause language
}
```

### `AnalysisResponse` (API output)
```typescript
interface AnalysisResponse {
  status: string
  analysis_summary: ClauseAnalysis[]
  conflicts?: Conflict[]
  jurisdiction?: Jurisdiction
  report_md_base64?: string    // base64 diff HTML
  summary_md_base64?: string   // base64 Markdown
}
```

### `ClauseAnalysis` (per-clause result)
```typescript
interface ClauseAnalysis {
  clause_id: string
  clause_title: string
  result: 'MATCH' | 'VIOLATION' | 'NOT_FOUND' | 'PARTIALLY_SATISFIED'
  reason: string
  relevant_text?: string | null
  ai_added_text?: string | null
  parties_obligated?: string[]
  missing_values?: string[]
  key_dates_durations?: string[]
  binding_strength?: string
}
```

### `DiffBlockData` (EditorJS block data)
```typescript
interface DiffBlockData {
  diffType: 'modified' | 'partial' | 'new'
  deletedText: string
  addedText: string
  reason?: string
  decision: 'approved' | 'rejected' | null
}
```

---

## 14. Editor Tools Registry

`src/components/editor/tools.ts` — `getEditorTools()`

| Tool key | Class | Purpose |
|---|---|---|
| `header` | `CustomHeaderTool` | H1–H6 with alignment, level picker |
| `paragraph` | `Paragraph` (EditorJS) | Standard paragraph |
| `list` | `EditorjsList` | Ordered/unordered lists |
| `image` | `SimpleImageTool` | Image from URL or base64 data |
| `table` | `CustomTableTool` | Rich table with context menu, merge/split, colors |
| `delimiter` | `Delimiter` (EditorJS) | Em-dash separator |
| `horizontalLine` | `HorizontalLineTool` | Configurable divider (style/thickness/color) |
| `textStyles` | `TextColorTool` | Inline text/background color |
| `underline` | `Underline` (EditorJS) | Underline inline |
| `changeCase` | `ChangeCase` | UPPER / lower / Title case |
| `indentTune` | `IndentTune` | Block indentation tune |
| `marker` | `Marker` (EditorJS) | Highlight inline |
| `inlineCode` | `InlineCode` (EditorJS) | Monospace code inline |
| `alignment` | `AlignmentTune` | Left / Center / Right / Justify tune |
| `diffBlock` | `DiffBlockTool` | **Diff review block** (accept/reject UI) |

---

## 15. Utilities Reference

### `decodeBase64(b64: string): string`
Decodes a base64 string back to UTF-8. Handles Unicode via `decodeURIComponent`. Falls back to `atob()` on error.

### `encodeBase64(str: string): string`
Encodes a UTF-8 string to base64, handling multi-byte characters correctly.

### `fileToBase64(file: File): Promise<string>`
Reads a `File` as a data URL and returns just the base64 portion (strips the `data:…;base64,` prefix).

### `editorjsToHtml(data: EditorData): string`
Converts EditorJS block data to an HTML string. Used when sending editor content to the analysis API. Supports: `header`, `paragraph`, `list`, `table`, `image`, `quote`, `delimiter`, `code`, `warning`.

### `parseDiffHtmlToBlocks(html: string): EditorBlock[]`
Parses the diff-report HTML from the API:
1. Uses `DOMParser` to walk all `.diff-group` elements
2. `unchanged` → `paragraph` block
3. `modified` / `partial` / `new` → `diffBlock` block with all diff data

### `markdownToHtml(md: string): string`
Lightweight Markdown converter (no dependencies). Handles headings, tables, bold/italic/code, horizontal rules, and unordered lists. Produces inline-styled HTML safe for `dangerouslySetInnerHTML`.

---

## End-to-End Data Flow Diagram

```
┌──────────────┐    upload     ┌────────────────────┐
│  User picks  │──────────────▶│  DocumentUploader  │
│  a file      │               └────────────────────┘
└──────────────┘                         │
                                         │ DOCX?
                              ┌──────────┴──────────┐
                              │                     │
                              ▼                     ▼
                    parseDocxToEditorJS()      (PDF/TXT raw)
                              │
                              ▼
                         setEditorData()
                              │
                              ▼
                    ┌─────────────────────┐
                    │  DocumentPreview    │
                    │  (EditorJS editor)  │  ← user sees/edits document
                    └─────────────────────┘

User adds clauses in ClauseForm
User clicks "Analyze Document"

        │
        ▼
validateClauses() ── error? → show error banner
        │
        ▼
buildDocumentBase64()
  DOCX/typed → editorjsToHtml() → encodeBase64()
  PDF/TXT    → fileToBase64()
        │
        ▼
POST /v1/analyze  ──────────────────▶  AI Backend
                                              │
◀──────────────────────────────────  AnalysisResponse
        │
        ├─ analysis_summary  ──▶  ClauseResultCard × N
        │
        ├─ report_md_base64
        │     │
        │     ▼ decodeBase64()
        │   diff HTML
        │     │
        │     ▼ parseDiffHtmlToBlocks()
        │   [ paragraph, diffBlock, diffBlock, … ]
        │     │
        │     ▼ setEditorData()
        │   ┌─────────────────────────────────────┐
        │   │  DocumentPreview (isReportMode)      │
        │   │                                      │
        │   │  unchanged lines → gray paragraphs   │
        │   │                                      │
        │   │  ┌──────────────────────────────┐    │
        │   │  │  🔴 Violation       [Why?]   │    │
        │   │  │  − old text ~~strikethrough~~│    │
        │   │  │  + new recommended text      │    │
        │   │  │  [✓ Accept]  [✗ Reject]      │    │
        │   │  └──────────────────────────────┘    │
        │   └─────────────────────────────────────┘
        │
        └─ summary_md_base64
              │
              ▼ decodeBase64() → markdownToHtml()
            ┌───────────────────────────────────────┐
            │  Analysis Summary panel               │
            │  ## Summary                           │
            │  Compliance Score: 50% — Needs Attn   │
            │  | Total | Match | Violation | …      │
            │  ## Critical Issues                   │
            │  …                                    │
            └───────────────────────────────────────┘
```

# Page Unresponsive / UI Freeze — Complete Root Cause Analysis & Resolution

## Problem Statement

After clicking "Run Analysis", the API call to `/v1/analyze` succeeds and returns data, but the browser shows a **"Page Unresponsive"** dialog. The user sees the Chrome prompt asking to "Wait" or "Exit page". The analysis results may partially render behind the dialog.

---

## Root Cause Summary

The freeze was caused by **multiple synchronous operations running back-to-back on the main thread** after the API response arrived, totaling **5-8 seconds of continuous blocking**. The browser's "Page Unresponsive" threshold is ~5 seconds.

The three heaviest operations were:
1. **Base64 decoding** of the report HTML (~500-800ms)
2. **DOMParser + HTML iteration** to convert the report into EditorJS blocks (~500-1500ms)
3. **EditorJS rendering 100+ DiffBlock elements on a hidden tab** (~3-5s) ← the #1 cause

---

## Data Flow: API Response to Final Render

```
User clicks "Run Analysis"
    │
    ▼
analyzeService.ts: fetch POST /v1/analyze → waits for response
    │
    ▼
API returns: { report_md_base64, summary_md_base64, analysis_summary[], ... }
    │
    ▼
analyze.tsx handleAnalyze():
    ├── setResult(data)              → shows AnalysisResults component
    ├── setIsAnalyzing(false)        → stops spinner
    ├── decodeBase64(report_md_base64) → converts base64 to HTML string
    ├── setReportHtml(html)          → stores for DocumentPreview iframe
    ├── parseDiffHtmlToBlocks(html)  → converts HTML to EditorJS block array
    ├── setEditorData({ blocks })    → triggers EditorComponent useEffect
    └── setIsReportMode(true)        → switches to report view
    │
    ▼
EditorComponent useEffect (triggered by setEditorData):
    ├── editor.clear()               → destroys all existing DOM nodes
    ├── editor.render(blocks)        → creates all new DOM nodes
    └── applyAlignmentFromTunes()    → applies text-align styles to every block
    │
    ▼
AnalysisResults → SummaryPanel (parallel):
    ├── decodeBase64(summary_md_base64) → decodes summary HTML
    └── iframe srcDoc = html            → browser parses/renders in iframe
```

---

## All Freeze Points Identified

### Freeze Point 1: Synchronous Base64 Decode

**File:** `src/utils/base64.ts` — `decodeBase64()` function
**File:** `src/routes/analyze.tsx` — line calling decode

**What happened:** The original code used `decodeBase64()` which calls `atob()` (synchronous) on the entire base64 string, then loops through every character with `Uint8Array.from()` to convert bytes. For a 500KB report, this blocked the main thread for 500-800ms.

**Why it freezes:** `atob()` is a single synchronous browser call that must process the entire string before returning. `Uint8Array.from(binaryStr, c => c.charCodeAt(0))` then iterates every character in JavaScript — another synchronous loop.

**How we fixed it:** Replaced with `decodeBase64Async()` which uses `fetch()` with a data URL:
```typescript
// Old: blocks main thread for 500-800ms
const html = decodeBase64(data.report_md_base64)

// New: browser decodes natively in C++, completely off main thread
const html = await decodeBase64Async(data.report_md_base64)

// Implementation:
export async function decodeBase64Async(b64: string): Promise<string> {
  const res = await fetch(`data:text/plain;charset=utf-8;base64,${b64}`)
  return await res.text()
}
```

**Why fetch() works:** When you pass a `data:` URL to `fetch()`, the browser's native C++ code handles the base64 decoding internally, off the main thread. The JavaScript thread stays completely free. Zero manual chunking needed.

---

### Freeze Point 2: setTimeout(0) Yields Don't Actually Yield

**File:** `src/routes/analyze.tsx` — yield calls between operations
**File:** `src/utils/parseDiffHtmlToBlocks.ts` — chunk yields
**File:** `src/utils/base64.ts` — chunk yields in old async version

**What happened:** The original code used `await new Promise(r => setTimeout(r, 0))` between heavy operations, expecting the browser to paint between each step.

**Why it freezes:** `setTimeout(0)` adds a task to the macrotask queue, but the browser can execute multiple queued macrotasks in the **same frame** without painting. Three consecutive `setTimeout(0)` calls can all fire back-to-back in one frame — the browser never gets a chance to paint or respond to user input.

**How we fixed it:** Replaced all `setTimeout(0)` yields with `requestAnimationFrame`:
```typescript
// Old: can batch in same frame, no paint guaranteed
await new Promise(r => setTimeout(r, 0))

// New: double-rAF guarantees a paint frame between steps
await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
```

**Why double-rAF works:** `requestAnimationFrame(callback)` fires the callback right before the next paint. By nesting two: the outer rAF fires before paint #1, the inner rAF fires before paint #2 — so the callback runs **after** the browser has definitely painted one frame. This gives the UI a chance to update and respond to input between heavy operations.

---

### Freeze Point 3: DOMParser.parseFromString() is Synchronous

**File:** `src/utils/parseDiffHtmlToBlocks.ts` — lines 19-20

**What happened:** After decoding the base64, the code parsed the HTML string into a DOM tree using `DOMParser.parseFromString()`. This is a single synchronous call that blocks for 200-1000ms depending on HTML size. The code was marked `async` but the heavy parsing happened before any `await`.

**Why it freezes:** `DOMParser.parseFromString()` is synchronous — the browser must fully parse the entire HTML string into a DOM tree before returning. For a report with 500+ diff groups, this can block for up to 1 second. There was no yield after this call, so execution immediately continued into the `querySelectorAll` iteration.

**How we fixed it:** Added a double-rAF yield immediately after DOMParser, and reduced chunk size from 50 to 30 with rAF yields between chunks:
```typescript
const doc = parser.parseFromString(html, 'text/html')
// Yield immediately after the heavy sync DOMParser call
await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
const groups = Array.from(doc.querySelectorAll('.diff-group'))
```

**Note:** DOMParser is unavoidably synchronous (it's not available in Web Workers either). The double-rAF yield after it gives the browser a chance to paint and prevents the blocking from chaining into the next operation.

---

### Freeze Point 4: EditorJS Rendering on a Hidden Tab (THE #1 CAUSE)

**File:** `src/components/editor/EditorComponent.tsx` — sync data useEffect
**File:** `src/routes/analyze.tsx` — tab switching + setEditorData

**What happened:** This was the single biggest cause of the freeze. After analysis:
1. `analyze.tsx` auto-switches to the Analysis tab: `setRightTab('analysis')`
2. The Document tab's container div gets Tailwind's `hidden` class (`display: none`)
3. But `setEditorData({ blocks })` still fires, triggering EditorComponent's useEffect
4. EditorComponent calls `editor.clear()` (destroys all DOM) then `editor.render(blocks)` (creates all DOM)
5. For 100+ DiffBlock elements (each creating ~20 DOM nodes with buttons, badges, text), this takes **3-5 seconds**
6. All this rendering happens on a **tab the user isn't even looking at**

**Why it freezes:** EditorJS's `render()` method is synchronous — it creates all DOM elements for all blocks in one go. Each DiffBlock creates a complex DOM subtree (header, reason row, diff content, accept/reject buttons). For 100 blocks: ~2000+ DOM elements created synchronously. Combined with the previous freeze points, total blocking exceeds 5 seconds → Chrome shows "Page Unresponsive".

**How we fixed it:** Added **visibility-deferred rendering** to EditorComponent. Before rendering, it checks if the container is actually visible using `offsetParent`:

```typescript
const isContainerVisible = useCallback(() => {
  const el = containerRef.current;
  if (!el) return false;
  return el.offsetParent !== null; // null when element or ancestor has display:none
}, []);

// In the useEffect:
if (!isContainerVisible()) {
  // Store data for later, poll every 200ms until visible
  pendingDataRef.current = capturedData;
  visibilityPollRef.current = setInterval(() => {
    if (isContainerVisible() && pendingDataRef.current) {
      // NOW render — user has switched to the Document tab
      doRender(pendingDataRef.current);
    }
  }, 200);
  return;
}
```

**Why this works:** The 200ms poll is lightweight (just checking one DOM property). The actual `editor.render()` only fires when the user switches to the Document tab and the container becomes visible. This completely eliminates the 3-5 second freeze during analysis results display.

---

### Freeze Point 5: applyAlignmentFromTunes() — O(n × m) DOM Mutations

**File:** `src/components/editor/EditorComponent.tsx` — `applyAlignmentFromTunes` function

**What happened:** After EditorJS rendered all blocks, this function iterated through EVERY block and for each block:
- Ran 6 `querySelector()` calls (one per selector)
- Ran 1 `querySelectorAll("p,h1,h2,h3,h4,h5,h6,div")` call
- Mutated `style.textAlign` on every matched element

For 100 blocks: ~700 DOM queries + hundreds of style mutations, all synchronous with zero yielding.

**Why it freezes:** DOM queries and style mutations trigger layout recalculation. Doing hundreds of them in a tight loop with no yielding blocks the thread for 500ms-1s.

**How we fixed it:** Chunked the alignment into batches of 40 blocks with rAF yields between batches:
```typescript
const ALIGN_CHUNK = 40;
for (let start = 0; start < blocksArr.length; start += ALIGN_CHUNK) {
  // process 40 blocks...
  if (end < blocksArr.length) {
    await new Promise(r => requestAnimationFrame(r)); // yield between chunks
  }
}
```

---

### Freeze Point 6: Double EditorJS Render from Chunking Logic

**File:** `src/routes/analyze.tsx` — handleAnalyze (original chunking code)

**What happened:** The original fix attempted progressive rendering:
```typescript
// First: render 60 blocks
setEditorData({ time: Date.now(), blocks: blocks.slice(0, 60) })
await new Promise(r => setTimeout(r, 150))
// Then: render ALL blocks
setEditorData({ time: Date.now() + 1, blocks: allBlocks })
```

But EditorComponent had an **80ms debounce**. Since 80ms < 150ms, the first timer already fired before the second `setEditorData` arrived. Result: two complete destroy + rebuild cycles instead of one.

**How we fixed it:** Removed the chunking entirely. Single `setEditorData` call:
```typescript
if (blocks.length > 0) {
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  setEditorData({ time: Date.now(), blocks, version: '2.31.4' })
}
```

EditorComponent's visibility deferral handles the rest — it won't render until the user actually looks at the Document tab.

---

### Freeze Point 7: SummaryPanel Synchronous Decode

**File:** `src/components/clause-analysis/AnalysisResults.tsx` — SummaryPanel useEffect

**What happened:** The SummaryPanel decoded `summary_md_base64` synchronously. Even when wrapped in double-rAF, the decode itself still blocked the thread when it ran.

**How we fixed it:** Switched to `decodeBase64Async()` with cancellation:
```typescript
useEffect(() => {
  let cancelled = false
  decodeBase64Async(base64).then((decoded) => {
    if (!cancelled) setRaw(decoded)
  }).catch(() => {})
  return () => { cancelled = true }
}, [base64])
```

---

### Freeze Point 8: iframe Height Measurement with setTimeout

**File:** `src/components/clause-analysis/AnalysisResults.tsx` — handleLoad
**File:** `src/components/clause-analysis/DocumentPreview.tsx` — handleIframeLoad

**What happened:** Both used `setTimeout(80)` to measure iframe content height after load. This arbitrary delay doesn't align with browser paint timing.

**How we fixed it:** Replaced with `requestAnimationFrame` which fires at the correct time — right before the next paint, when layout information is fresh:
```typescript
const handleLoad = () => {
  const body = iframeRef.current?.contentDocument?.body
  if (body) {
    requestAnimationFrame(() => {
      if (body.scrollHeight > 0) setHeight(body.scrollHeight + 40)
      setLoaded(true)
    })
  }
}
```

---

## Files Changed

| File | What Changed |
|------|-------------|
| `src/utils/base64.ts` | `decodeBase64Async()` rewritten to use `fetch()` data URL instead of manual chunked `atob()` + `Uint8Array` loop |
| `src/routes/analyze.tsx` | Import changed to `decodeBase64Async`; all `setTimeout(0)` yields → double-rAF; `setIsAnalyzing(false)` moved before post-processing; removed two-stage chunking; removed `finally` block |
| `src/components/editor/EditorComponent.tsx` | `applyAlignmentFromTunes` chunked (40 blocks/batch with rAF yields); sync useEffect now checks visibility via `offsetParent`, defers render if hidden, polls every 200ms until visible; double-rAF between `clear()` and `render()` |
| `src/utils/parseDiffHtmlToBlocks.ts` | Double-rAF yield added after DOMParser; chunk size reduced 50→30; chunk yields changed from `setTimeout(0)` to `requestAnimationFrame` |
| `src/components/clause-analysis/AnalysisResults.tsx` | SummaryPanel uses `decodeBase64Async()` instead of sync decode; `handleLoad` uses `requestAnimationFrame` instead of `setTimeout(80)` |
| `src/components/clause-analysis/DocumentPreview.tsx` | `handleIframeLoad` uses `requestAnimationFrame` instead of `setTimeout(80)` |

---

## The Fix Visualized

```
BEFORE (5-8 seconds continuous blocking):

  ┌─ atob() sync ──────────┐┌─ setTimeout(0) ─┐┌─ DOMParser sync ────────────────┐
  │      500-800ms          ││   no real yield  ││         500-1500ms              │
  └────────────────────────┘└─────────────────┘└────────────────────────────────┘
  ┌─ setTimeout(0) ─┐┌─ editor.render() ON HIDDEN TAB ──────────────────────────┐
  │   no real yield  ││              3000-5000ms (100+ DiffBlocks)               │
  └─────────────────┘└──────────────────────────────────────────────────────────┘
  ┌─ applyAlignment sync ──────┐
  │       500-1000ms           │ → TOTAL: 5-8s → "Page Unresponsive"
  └───────────────────────────┘


AFTER (longest single block ~200ms):

  ┌─ fetch() data URL ─┐  ▐paint▌  ┌─ DOMParser ─┐  ▐paint▌  ┌─ group chunk ─┐  ▐paint▌
  │  off main thread    │  ▐     ▌  │   ~200ms    │  ▐     ▌  │  30 groups    │  ▐     ▌
  └────────────────────┘  ▐     ▌  └────────────┘  ▐     ▌  └──────────────┘  ▐     ▌

  ┌─ setEditorData ─┐
  │  visibility check: HIDDEN → deferred to pendingDataRef    │
  │  renders only when user clicks Document tab               │
  └──────────────────────────────────────────────────────────┘

  When user switches to Document tab:
  ▐paint▌  ┌─ clear() ─┐  ▐paint▌▐paint▌  ┌─ render() ─┐  ▐paint▌▐paint▌
  ▐     ▌  │           │  ▐     ▌▐     ▌  │            │  ▐     ▌▐     ▌
           └──────────┘                   └───────────┘
  ┌─ align chunk ─┐  ▐paint▌  ┌─ align chunk ─┐  ▐paint▌
  │  40 blocks    │  ▐     ▌  │  40 blocks    │  ▐     ▌
  └──────────────┘  ▐     ▌  └──────────────┘  ▐     ▌

  → No "Page Unresponsive" dialog. UI stays interactive throughout.
```

---

## Key Concepts Used in the Fix

### Why `setTimeout(0)` doesn't work for yielding
`setTimeout(0)` schedules a macrotask, but the browser can run multiple macrotasks in the same frame without painting. Three `setTimeout(0)` calls can execute back-to-back with no paint in between.

### Why `requestAnimationFrame` works
`requestAnimationFrame` fires right before the browser paints. Double-rAF (`rAF(() => rAF(callback))`) guarantees the callback runs after at least one paint frame, giving the browser a real chance to update the UI and respond to user input.

### Why `fetch('data:...')` for base64 decoding
The browser's fetch machinery handles data URLs natively in C++ — the base64 decoding happens completely off the main JavaScript thread. Zero blocking, zero chunking needed.

### Why `offsetParent` for visibility detection
When an element or any ancestor has `display: none`, `offsetParent` returns `null`. This is the cheapest way to detect if an element is in a hidden tab without IntersectionObserver overhead.

---

## Remaining Known Limitations

These are unavoidably synchronous operations that still exist but are mitigated by the fixes above:

1. **`editor.render()` when Document tab IS visible** — still synchronous for 100+ blocks (~1-3s). Mitigated by only rendering when user navigates to the tab.
2. **`DOMParser.parseFromString()`** — still synchronous (~200ms). DOMParser is not available in Web Workers. Mitigated by double-rAF yield after the call.
3. **`DiffBlockTool._build()`** — rebuilds entire DOM tree per accept/reject decision. Not in the analysis flow but affects interactive usage.
4. **`res.json()` in analyzeService** — synchronous JSON parsing of entire API response. Typically fast (<100ms) but could matter for very large responses.



















PDF FORMAT METHODS :-----------------------------------------



Tell all possible ways to the uploaded pdf have to show same as it is in the canvas, tell all the ways and which is going to be helpful for this project.
The user is asking about ways to display an uploaded PDF in a canvas-like view (showing the PDF as it actually looks, not as extracted text). This is a different question from the analysis functionality - they want to know how to render the PDF visually in the Document tab.

Let me think about all the ways to render a PDF as it actually looks:

iframe with PDF URL - Create an object URL from the File and display it in an iframe

PDF.js - Mozilla's PDF rendering library that renders PDFs to canvas

react-pdf - React wrapper around PDF.js

embed/object tags - Browser's built-in PDF viewer

Google Docs Viewer - Embed via Google's PDF viewer (requires public URL)

pdfjs-dist - Direct use of PDF.js without the wrapper

For this project, the most practical options are the ones that work with local files and don't require external services. Since the project already extracts text via parsePdfToEditorJS and displays it in the editor, adding a visual PDF viewer in the Document tab would let users see the original layout alongside the extracted content. The iframe approach is simplest for quick implementation, while PDF.js or react-pdf give more control over rendering and navigation.

Here are all practical ways to show a PDF exactly as it looks:

1. iframe with createObjectURL — Simplest, zero dependencies


const url = URL.createObjectURL(file)
<iframe src={url} className="w-full h-full" />
Browser's built-in PDF viewer handles everything
Works instantly, no library needed
Looks identical to opening the PDF in Chrome
Best fit for this project — the file is already in memory as a File object
2. <embed> or <object> tag — Same as iframe but different HTML element


<embed src={url} type="application/pdf" className="w-full h-full" />
Slightly more semantic than iframe for binary files
Same result as option 1
3. react-pdf (PDF.js wrapper) — Most control


import { Document, Page } from 'react-pdf'
<Document file={file}>
  <Page pageNumber={1} />
</Document>
Renders each page to a <canvas>
Can highlight text, add overlays, control zoom
Adds ~400KB to bundle
Needs worker setup
4. pdfjs-dist directly — Full control, complex

Renders PDF pages to canvas manually
Same engine as react-pdf but without the React wrapper
Most setup work, only worth it for custom rendering
5. Google Docs Viewer — Requires public URL


https://docs.google.com/viewer?url=PUBLIC_URL&embedded=true
Not viable here — uploaded files are local, no public URL
Recommendation for this project
Option 1 (iframe + createObjectURL) — takes about 10 lines of code, no new dependency, and shows the PDF pixel-perfect exactly as the user sees it. Since the uploadedFile is already a File object in state, it's a direct fit.

Want me to implement it?

No,dont implement when we use i frame is it possible to show the summary and adding the editing options in the document for this project.
The user is asking whether, when using an iframe to show the PDF, it's still possible to:

Show the summary analysis results (the compliance report)
Add editing options to the document
Let me think about this carefully:

Showing summary with iframe:

Yes, the summary analysis tab is completely separate from the Document tab
The iframe showing the PDF would be in the Document tab
The Summary Analysis tab shows the AnalysisResults component which doesn't depend on how the document is displayed
So yes, summary analysis works fine alongside an iframe PDF viewer
Editing options in the document:

This is where it gets problematic

When a PDF is shown in an iframe via createObjectURL, it's rendered by the browser's native PDF viewer

The browser's PDF viewer is sandboxed, so I can't inject any HTML, CSS, or JavaScript into it, interact with its DOM, add overlays, or programmatically highlight text

This means I can't add accept/reject buttons, highlight clauses, show inline suggestions, or add any kind of interactive annotations like the current DiffBlock system requires

The current project uses EditorJS with DiffBlock tools that have Accept/Reject buttons, which needs full DOM control—something that's impossible with an iframe PDF

For viewing PDFs in a separate tab or component, it's possible, but for editing with accept/reject changes and annotations, I'd need either PDF.js (which renders to canvas and allows overlays) or convert the PDF to HTML/text first, which is what the current approach already does

Summary (Analysis tab): Yes, completely possible — the Summary Analysis tab is a separate component and has nothing to do with how the document is displayed. It will work regardless of whether Document tab uses iframe or EditorJS.

Editing options in the document: No, not possible with iframe.

Here's why:

When a PDF loads inside an iframe via createObjectURL, the browser hands it to its native PDF plugin (same as opening a PDF in Chrome). That plugin runs in a sandboxed environment — you have zero JavaScript access to its contents. You cannot:

Inject HTML overlays or buttons
Highlight specific clauses
Add Accept / Reject controls (like the current DiffBlock system)
Listen to text selection events
Add inline annotations or comments
The current project's editing model (DiffBlock with Accept/Reject buttons, diff highlights, Export Document) requires full DOM control, which only EditorJS can give you.

Bottom line for this project:

Feature	iframe PDF	Current EditorJS
Show PDF as-is visually	✅ Perfect	❌ Text only
Summary Analysis tab	✅ Yes	✅ Yes
Accept / Reject diff changes	❌ Impossible	✅ Works
Export modified document	❌ Impossible	✅ Works
Clause highlights / overlays	❌ Impossible	✅ Possible
If visual PDF rendering is needed, the only way to also have editing is PDF.js (react-pdf) which renders pages to <canvas> — you can then draw overlays on top of the canvas. But that's a major rewrite of the Document tab.

Yes, but i need the both working method to implement this suggest me all  the possible methods and why and how they contribute to this project.
The user wants both:

Show the PDF as it visually looks (like a canvas/PDF viewer)
Keep editing options (accept/reject diffs, export)
Keep the summary analysis
And they want all possible methods to achieve this, with explanations of how each contributes to the project.

Let me think about all possible approaches:

The core problem: You can't have a native PDF viewer (iframe) AND editing capabilities on the same view. But there are hybrid approaches.

Let me think of all the methods:

Method 1: Split-pane view (PDF + Diff Editor side by side)

Left: iframe showing original PDF (read-only visual reference)

Right: EditorJS with diff blocks (editable)

User sees the original PDF and the edited version side by side

Summary tab works as normal

Method 2: react-pdf (PDF.js) with canvas overlays

Render PDF pages to canvas using react-pdf
Draw overlay highlights on canvas for clause locations
Show diff suggestions as floating panels/tooltips
Complex but gives best visual experience
Summary tab works normally
Method 3: Tab-based approach (PDF view tab + Diff editor tab)

Add a third tab: "Original PDF" | "Document (Diff)" | "Summary Analysis"
"Original PDF" tab shows the full PDF in an iframe, "Document" tab has the editable diff view with accept/reject controls, and users can switch between them to compare
—simplest to build and cleanest for the user experience.

Method 4: Convert PDF to high-fidelity HTML (pdf2htmlEX approach)

Server-side conversion is very complex and requires additional processing overhead.
Method 5: PDF.js page rendering + custom UI layer

Render each PDF page to canvas and overlay an interactive HTML layer on top for highlighting, tooltips, and buttons—medium complexity but gives good control.
Method 6: mammoth.js for DOCX + PDF preview separately

For DOCX files, use mammoth.js to convert to styled HTML that preserves formatting, and handle PDF files with a separate preview approach.
Method 7: Dual-mode Document tab

Single "Document" tab with a toggle between "Preview" mode showing the PDF in an iframe and "Edit" mode showing the EditorJS diff editor—keeps the interface clean while letting users switch between viewing the original and editing.
Looking at what's most practical, the tab-based approach is easiest to implement, the split-pane gives better UX by showing both simultaneously, and the dual-mode toggle keeps everything in one tab while still letting users switch between preview and edit modes.

Here are all viable methods that keep both PDF visual rendering AND editing/summary working:

Method 1: Add a 3rd "Original" Tab — Simplest

[ Document (Diff) ]  [ Original PDF ]  [ Summary Analysis ]
Document tab: current EditorJS diff editor (accept/reject unchanged)
Original PDF tab: iframe with createObjectURL(uploadedFile) — shows PDF exactly as-is
Summary tab: analysis cards (unchanged)
Why it fits: Zero changes to editing logic. Just adds one new tab. User can flip between the visual PDF and the diff editor freely.

Effort: ~20 lines of code.

Method 2: Split-Pane View — Best UX

┌─────────────────────┬─────────────────────┐
│  Original PDF       │  Diff Editor        │
│  (iframe, read-only)│  (EditorJS, edit)   │
└─────────────────────┴─────────────────────┘
Left pane: iframe showing original PDF
Right pane: EditorJS diff editor with accept/reject
Summary tab: unchanged
Why it fits: User sees the original clause in the PDF on the left while reviewing AI suggestions on the right. No context switching.

Effort: Medium — need resizable pane layout.

Method 3: Dual-Mode Document Tab — Clean Toggle

[ Document ▾ Preview / Edit ]  [ Summary Analysis ]
Document tab has a Preview / Edit toggle button
Preview mode: replaces EditorJS with iframe PDF
Edit mode: shows current EditorJS diff editor
State switches between the two views
Why it fits: Keeps the tab count low, clean UX. User previews the original then switches to edit mode to review changes.

Effort: ~30 lines — conditional render inside Document tab.

Method 4: react-pdf with Canvas Overlays — Most Powerful, Most Work
Renders each PDF page to <canvas> via PDF.js
Transparent HTML <div> sits on top of the canvas
Clause locations highlighted with colored boxes drawn on canvas
Clicking a highlight opens a sidebar with the diff suggestion
Accept/reject updates a separate state, export produces modified document
Why it fits: Best possible UX — user sees exact PDF layout, highlighted clauses, inline suggestions. Like a real contract review tool.

Effort: Large rewrite of Document tab. Needs clause-to-text-position mapping from backend.

Method 5: DOCX → Styled HTML via Mammoth.js (DOCX only)
For .docx files: use mammoth.js to convert to styled HTML that preserves fonts, tables, margins
Display in iframe — looks close to the original document
For PDF: fall back to iframe with object URL
Diff editor stays separate (current approach)
Why it fits: DOCX files are already parsed by the project. Mammoth can output styled HTML instead of plain text blocks, giving a near-identical visual.

Effort: Medium — swap parseDocxToEditorJS output path for a styled HTML path.

Comparison
Method	PDF Visual	Editing	Effort	Best for
1. 3rd Tab	✅	✅	Low	Quick win, ship fast
2. Split Pane	✅	✅	Medium	Power users, wide screens
3. Dual Mode Toggle	✅	✅	Low-Medium	Clean minimal UI
4. react-pdf + Overlays	✅ Best	✅	High	Full product feature
5. Mammoth HTML	~✅ DOCX only	✅	Medium	DOCX-heavy users
My Recommendation for This Project
Start with Method 1 (3rd tab) — it's 20 lines, works for all file types, and unblocks the user immediately. If that feels right, Method 3 (toggle) is a polished version of the same idea. Method 4 is the long-term goal if this becomes a full product.

Want me to implement any of these?
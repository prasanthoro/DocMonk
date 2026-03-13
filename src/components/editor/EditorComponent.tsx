import EditorJS from "@editorjs/editorjs";
import { useEffect, useRef, useCallback, useState } from "react";
import { getEditorTools } from "./tools";

interface EditorData {
  time: number;
  blocks: Array<{
    id?: string;
    type: string;
    data: Record<string, any>;
    tunes?: Record<string, any>;
  }>;
  version: string;
}

interface EditorComponentProps {
  data?: EditorData | null;
  onChange?: (data: EditorData) => void;
  editorId?: string;
  readOnly?: boolean;
  minHeight?: number;
  placeholder?: string;
}

export default function EditorComponent({
  data,
  onChange,
  editorId = "editorjs-main",
  readOnly = false,
  minHeight = 300,
  placeholder = "Start typing or drop a document above…",
}: EditorComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorJS | null>(null);
  const mountedRef = useRef(false);
  const initializingRef = useRef(false);
  const lastDataTimeRef = useRef<number>(0);
  const onChangeRef = useRef(onChange);
  // Suppresses onChange during programmatic render / alignment application
  const suppressOnChangeRef = useRef(false);
  const onChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // ── Alignment ──────────────────────────────────────────────────────────────

  const applyAlignmentFromTunes = useCallback(async (editor: EditorJS) => {
    if (!mountedRef.current || !editor) return;
    // Suppress onChange while we mutate DOM — otherwise the MutationObserver
    // fires onChange → applyAlignment → onChange → infinite loop
    suppressOnChangeRef.current = true;
    try {
      const savedData = await editor.save();
      const blockEls = containerRef.current?.querySelectorAll(".ce-block") ?? [];
      const blocksArr = savedData.blocks;
      const ALIGN_CHUNK = 40;

      for (let start = 0; start < blocksArr.length; start += ALIGN_CHUNK) {
        if (!mountedRef.current) return;
        const end = Math.min(start + ALIGN_CHUNK, blocksArr.length);

        for (let i = start; i < end; i++) {
          const block = blocksArr[i];
          const alignment = block?.tunes?.alignment?.alignment || "left";
          const blockEl = blockEls[i] as HTMLElement | undefined;
          if (!blockEl) continue;

          const selectors = [
            ".ce-block__content",
            ".ce-header",
            ".cdx-paragraph",
            ".ce-list",
            ".ce-quote",
            ".professional-horizontal-line",
          ];

          let content: HTMLElement | null = null;
          for (const sel of selectors) {
            content = blockEl.querySelector(sel);
            if (content) break;
          }
          if (content) content.style.textAlign = alignment;

          blockEl.querySelectorAll("p,h1,h2,h3,h4,h5,h6,div").forEach((el) => {
            const e = el as HTMLElement;
            if (!e.style.textAlign) e.style.textAlign = alignment;
          });
        }

        // Yield to browser between chunks so it can paint
        if (end < blocksArr.length) {
          await new Promise((r) => requestAnimationFrame(r));
        }
      }
    } catch {
      // ignore
    } finally {
      // Re-enable onChange after a tick so queued MutationObserver events drain
      setTimeout(() => {
        suppressOnChangeRef.current = false;
      }, 50);
    }
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanupEditor = useCallback(async () => {
    if (onChangeTimerRef.current) {
      clearTimeout(onChangeTimerRef.current);
      onChangeTimerRef.current = null;
    }
    suppressOnChangeRef.current = false;
    if (editorRef.current) {
      try {
        if (typeof editorRef.current.destroy === "function") {
          await editorRef.current.destroy();
        }
      } catch { /* ignore */ }
      editorRef.current = null;
    }
    const el = document.getElementById(editorId);
    if (el) el.innerHTML = "";
    setIsReady(false);
    initializingRef.current = false;
  }, [editorId]);

  // ── Init ───────────────────────────────────────────────────────────────────

  const initEditor = useCallback(async (initialData?: EditorData | null) => {
    if (initializingRef.current || !mountedRef.current) return;
    initializingRef.current = true;

    try {
      await cleanupEditor();
      await new Promise((r) => setTimeout(r, 50));
      if (!mountedRef.current) return;

      const el = document.getElementById(editorId);
      if (el) el.innerHTML = "";

      const startData =
        initialData && initialData.blocks?.length > 0
          ? initialData
          : { time: Date.now(), blocks: [], version: "2.30.8" };

      // Suppress onChange during initial render
      suppressOnChangeRef.current = true;

      const editor = new EditorJS({
        holder: editorId,
        tools: getEditorTools() as any,
        data: startData,
        readOnly,
        minHeight,
        placeholder,
        onReady: () => {
          if (!mountedRef.current) return;
          setIsReady(true);
          lastDataTimeRef.current = startData.time;

          // Apply alignment then re-enable onChange
          // applyAlignmentFromTunes handles suppress internally
          setTimeout(() => {
            if (mountedRef.current) applyAlignmentFromTunes(editor);
          }, 100);

          const editorEl = document.getElementById(editorId);
          if (editorEl) {
            editorEl.setAttribute("data-gramm", "false");
            editorEl.setAttribute("data-gramm_editor", "false");
            editorEl.setAttribute("data-enable-grammarly", "false");
            editorEl.setAttribute("spellcheck", "false");
          }
        },
        onChange: () => {
          if (!mountedRef.current || suppressOnChangeRef.current) return;
          // Debounce rapid-fire onChange calls
          if (onChangeTimerRef.current) clearTimeout(onChangeTimerRef.current);
          onChangeTimerRef.current = setTimeout(async () => {
            onChangeTimerRef.current = null;
            if (!mountedRef.current || suppressOnChangeRef.current) return;
            try {
              const saved = await editor.save();
              if (!saved) return;
              lastDataTimeRef.current = saved.time ?? Date.now();
              onChangeRef.current?.(saved as EditorData);
            } catch { /* ignore */ }
          }, 300);
        },
      });

      editorRef.current = editor;
    } catch (err) {
      console.error("EditorJS init error:", err);
    } finally {
      initializingRef.current = false;
    }
  }, [editorId, readOnly, minHeight, placeholder, cleanupEditor, applyAlignmentFromTunes]);

  // ── Mount / unmount — only once per editorId ───────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    const currentData = data;
    initEditor(currentData);
    return () => {
      mountedRef.current = false;
      cleanupEditor();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorId]);

  // ── Sync externally-driven data (e.g. DOCX parse result, diff report) ─────

  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<EditorData | null>(null);
  const visibilityPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if the editor container is actually visible (not in a hidden tab)
  const isContainerVisible = useCallback(() => {
    const el = containerRef.current;
    if (!el) return false;
    // offsetParent is null when element or ancestor has display:none
    return el.offsetParent !== null;
  }, []);

  const doRender = useCallback(async (capturedData: EditorData) => {
    if (!mountedRef.current || !editorRef.current) return;
    try {
      suppressOnChangeRef.current = true;
      await new Promise((r) => requestAnimationFrame(r));
      if (!mountedRef.current || !editorRef.current) return;
      await editorRef.current.clear();
      // Double-rAF guarantees a paint frame between clear() and render()
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (!mountedRef.current || !editorRef.current) return;
      await editorRef.current.render(capturedData as any);
      lastDataTimeRef.current = capturedData.time;
      // Yield before alignment to let render paint first
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (mountedRef.current && editorRef.current) {
        applyAlignmentFromTunes(editorRef.current);
      }
    } catch {
      suppressOnChangeRef.current = false;
    }
  }, [applyAlignmentFromTunes]);

  useEffect(() => {
    if (!isReady || !editorRef.current) return;

    if (!data || !data.blocks?.length) {
      if (renderTimerRef.current) { clearTimeout(renderTimerRef.current); renderTimerRef.current = null; }
      if (visibilityPollRef.current) { clearInterval(visibilityPollRef.current); visibilityPollRef.current = null; }
      pendingDataRef.current = null;
      if (lastDataTimeRef.current !== 0) {
        lastDataTimeRef.current = 0;
        try { editorRef.current?.clear(); } catch { /* ignore */ }
      }
      return;
    }

    if (data.time === lastDataTimeRef.current) return;

    if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    if (visibilityPollRef.current) { clearInterval(visibilityPollRef.current); visibilityPollRef.current = null; }

    const capturedData = data;

    // If the editor is hidden (e.g. user is on a different tab), defer rendering
    // until it becomes visible. This prevents the massive EditorJS render() freeze
    // from blocking the UI while the user is looking at the Analysis tab.
    if (!isContainerVisible()) {
      pendingDataRef.current = capturedData;
      visibilityPollRef.current = setInterval(() => {
        if (!mountedRef.current) {
          if (visibilityPollRef.current) { clearInterval(visibilityPollRef.current); visibilityPollRef.current = null; }
          return;
        }
        if (isContainerVisible() && pendingDataRef.current) {
          const pending = pendingDataRef.current;
          pendingDataRef.current = null;
          if (visibilityPollRef.current) { clearInterval(visibilityPollRef.current); visibilityPollRef.current = null; }
          renderTimerRef.current = setTimeout(() => doRender(pending), 80);
        }
      }, 200);
      return () => {
        if (visibilityPollRef.current) { clearInterval(visibilityPollRef.current); visibilityPollRef.current = null; }
      };
    }

    pendingDataRef.current = null;
    renderTimerRef.current = setTimeout(() => doRender(capturedData), 80);

    return () => {
      if (renderTimerRef.current) { clearTimeout(renderTimerRef.current); renderTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isReady]);

  // ── Toggle readOnly ────────────────────────────────────────────────────────

  useEffect(() => {
    if (isReady && editorRef.current) {
      (editorRef.current as any).readOnly?.toggle(readOnly);
    }
  }, [readOnly, isReady]);

  // ── DiffBlock decision → propagate to React state ─────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isReady) return;
    const handler = async () => {
      if (!mountedRef.current || !editorRef.current) return;
      try {
        const saved = await editorRef.current.save();
        if (!saved) return;
        lastDataTimeRef.current = saved.time ?? Date.now();
        onChangeRef.current?.(saved as EditorData);
      } catch { /* ignore */ }
    };
    container.addEventListener('diff-decision-change', handler);
    return () => container.removeEventListener('diff-decision-change', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="editor-component-wrapper w-full">
      <div
        id={editorId}
        className="w-full"
        style={{ minHeight: `${minHeight}px` }}
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        spellCheck={false}
      />
    </div>
  );
}

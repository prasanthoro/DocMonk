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
  // Tracks last data seen — prevents blinking when parent echoes onChange back
  const lastDataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // ── Alignment ──────────────────────────────────────────────────────────────

  const applyAlignmentFromTunes = useCallback(async (editor: EditorJS) => {
    if (!mountedRef.current || !editor) return;
    try {
      const savedData = await editor.save();
      const blockEls = containerRef.current?.querySelectorAll(".ce-block") ?? [];

      savedData.blocks.forEach((block, i) => {
        const alignment = block?.tunes?.alignment?.alignment || "left";
        const blockEl = blockEls[i] as HTMLElement | undefined;
        if (!blockEl) return;

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
      });
    } catch {
      // ignore
    }
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanupEditor = useCallback(async () => {
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
          lastDataRef.current = JSON.stringify(startData);

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
        onChange: async () => {
          if (!mountedRef.current) return;
          try {
            const saved = await editor.save();
            if (!saved) return;
            // Stamp BEFORE parent callback — prevents the data-sync effect
            // from re-rendering when the parent echoes the new value back
            lastDataRef.current = JSON.stringify(saved);
            onChangeRef.current?.(saved as EditorData);
            setTimeout(() => {
              if (mountedRef.current) applyAlignmentFromTunes(editor);
            }, 150);
          } catch { /* ignore */ }
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

  // ── Sync externally-driven data (e.g. DOCX parse result) ──────────────────

  useEffect(() => {
    if (!isReady || !editorRef.current || !data || !data.blocks?.length) return;
    const incoming = JSON.stringify(data);
    if (incoming === lastDataRef.current) return;

    const render = async () => {
      try {
        await editorRef.current?.clear();
        await editorRef.current?.render(data as any);
        lastDataRef.current = incoming;
        setTimeout(() => {
          if (mountedRef.current && editorRef.current) {
            applyAlignmentFromTunes(editorRef.current);
          }
        }, 200);
      } catch { /* don't re-init — avoids blink on error */ }
    };
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isReady]);

  // ── Toggle readOnly ────────────────────────────────────────────────────────

  useEffect(() => {
    if (isReady && editorRef.current) {
      (editorRef.current as any).readOnly?.toggle(readOnly);
    }
  }, [readOnly, isReady]);

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

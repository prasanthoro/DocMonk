import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { v4 as uuidv4 } from 'uuid'
import {
  askQAAPI,
  createQASessionAPI,
  deleteQASessionAPI,
  getQASessionAPI,
  getQASessionsAPI,
  regenerateMessageAPI,
  renameQASessionAPI,
  retryMessageAPI,
  type QADocument,
  type QAMessageRecord,
  type QASessionRecord,
} from '../lib/api'

export const Route = createFileRoute('/qa')({ component: QAPage })

const SESSION_USER_ID = 'docmonk-user-' + Math.random().toString(36).slice(2)

type MessageStatus = 'streaming' | 'done' | 'error' | 'partial'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  relevant_excerpt?: string
  page_hint?: string | number
  status: MessageStatus
  createdAt?: string
}

interface LocalPreviewDoc {
  document_id: string
  document_filename: string
  file_type?: string
  previewUrl?: string
  previewText?: string
}

function renderMarkdown(text: string) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="inline-code">$1</code>')
    .replace(/\n/g, '<br/>')
}

function parseFileType(filename: string) {
  return filename.split('.').pop()?.toLowerCase() || 'file'
}

function mapMessageRecord(m: QAMessageRecord): ChatMessage {
  return {
    id: m.message_id,
    role: m.role,
    content: m.content || '',
    relevant_excerpt: m.relevant_excerpt,
    page_hint: m.page_hint,
    status: 'done',
    createdAt: m.created_at,
  }
}

function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onCreateSession,
  isLoading,
}: {
  sessions: QASessionRecord[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, name: string) => Promise<void>
  onCreateSession: () => void
  isLoading: boolean
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const startRename = (session: QASessionRecord) => {
    setRenamingId(session.session_id)
    setRenameValue(session.name || '')
    setTimeout(() => renameInputRef.current?.focus(), 60)
  }

  const commitRename = async (sessionId: string) => {
    const trimmed = renameValue.trim()
    if (trimmed) await onRenameSession(sessionId, trimmed)
    setRenamingId(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 p-4">
        <button
          onClick={onCreateSession}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
        >
          <span className="text-base">+</span>
          New Session
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">No sessions found</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.session_id}
              className={`group relative cursor-pointer rounded-xl border px-3 py-3 transition ${activeSessionId === session.session_id
                  ? 'border-indigo-100 bg-indigo-50'
                  : 'border-transparent hover:bg-slate-50'
                }`}
              onClick={() => onSelectSession(session.session_id)}
              onDoubleClick={() => startRename(session)}
            >
              {renamingId === session.session_id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(session.session_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(session.session_id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-lg border border-indigo-300 px-2 py-1 text-sm focus:outline-none"
                />
              ) : (
                <>
                  <p className="truncate text-sm font-semibold text-slate-700">
                    {session.name || 'Untitled Session'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {session.documents?.[0]?.document_filename || 'No document'}
                    {(session.documents?.length || 0) > 1 ? ` +${(session.documents?.length || 1) - 1}` : ''}
                  </p>
                </>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteSession(session.session_id)
                }}
                className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 group-hover:flex"
                title="Delete session"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function NewSessionPanel({
  onCreated,
}: {
  onCreated: (
    session: QASessionRecord,
    localPreviewDocs: LocalPreviewDoc[],
    requestedName: string,
  ) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [sessionName, setSessionName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles])
    setError(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
    },
    multiple: true,
  })

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const createSession = async () => {
    if (files.length === 0) {
      setError('Please upload at least one document.')
      return
    }
    setError(null)
    setIsCreating(true)

    try {
      const docs = await Promise.all(
        files.map(async (file) => {
          const dataUrl = await fileToDataUrl(file)
          const ext = parseFileType(file.name)
          const previewText = ext === 'txt' ? (await file.text()).slice(0, 8000) : undefined
          const previewUrl = ext === 'pdf' ? URL.createObjectURL(file) : undefined
          const document_id = `uploads/local/${uuidv4()}-${file.name}`

          return {
            requestDoc: {
              document_id,
              document_base64: dataUrl,
              document_filename: file.name,
            },
            localPreview: {
              document_id,
              document_filename: file.name,
              file_type: ext,
              previewText,
              previewUrl,
            } as LocalPreviewDoc,
          }
        }),
      )

      const session = await createQASessionAPI({
        user_id: SESSION_USER_ID,
        documents: docs.map((d) => d.requestDoc),
      })

      onCreated(
        session,
        docs.map((d) => d.localPreview),
        sessionName.trim(),
      )
    } catch (e: any) {
      setError(e?.message || 'Failed to create session.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center p-8">
      <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Create Q&A Session</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload one or more documents, then start asking questions.
          </p>
        </div>

        <input
          type="text"
          placeholder="Session name (optional)"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 focus:border-indigo-300 focus:outline-none"
        />

        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${isDragActive
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
            }`}
        >
          <input {...getInputProps()} />
          <p className="text-sm font-semibold text-slate-600">
            {isDragActive ? 'Drop files here' : 'Drop documents or click to browse'}
          </p>
          <p className="mt-1 text-xs text-slate-400">PDF, DOCX, DOC, TXT</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, idx) => (
              <div key={`${file.name}-${idx}`} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="flex-1 truncate text-sm text-slate-700">{file.name}</span>
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 transition hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={createSession}
          disabled={isCreating || files.length === 0}
          className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating ? 'Creating session...' : 'Create Session'}
        </button>
      </div>
    </div>
  )
}

function DocumentPreviewPanel({
  session,
  localDocs,
}: {
  session: QASessionRecord | null
  localDocs: LocalPreviewDoc[]
}) {
  const docs = session?.documents || []
  const [selectedId, setSelectedId] = useState<string | null>(docs[0]?.document_id || null)

  useEffect(() => {
    setSelectedId(docs[0]?.document_id || null)
  }, [session?.session_id, docs.length])

  const selectedDoc = docs.find((d) => d.document_id === selectedId) || docs[0]
  const localDoc =
    localDocs.find((d) => d.document_id === selectedDoc?.document_id) ||
    localDocs.find((d) => d.document_filename === selectedDoc?.document_filename)

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-sm font-bold text-slate-800">Document Preview</h3>
        <p className="mt-0.5 text-xs text-slate-400">
          {docs.length} document{docs.length !== 1 ? 's' : ''} in this session
        </p>
      </div>

      {docs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-2">
          {docs.map((doc) => (
            <button
              key={doc.document_id}
              onClick={() => setSelectedId(doc.document_id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedDoc?.document_id === doc.document_id
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
            >
              {doc.document_filename}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!selectedDoc ? (
          <p className="text-sm text-slate-400">No document available.</p>
        ) : localDoc?.previewUrl ? (
          <iframe
            title={selectedDoc.document_filename}
            src={localDoc.previewUrl}
            className="h-full min-h-[500px] w-full rounded-xl border border-slate-200"
          />
        ) : localDoc?.previewText ? (
          <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {localDoc.previewText}
          </pre>
        ) : (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">{selectedDoc.document_filename}</p>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
              <div>
                <p className="text-slate-400">Document ID</p>
                <p className="truncate">{selectedDoc.document_id}</p>
              </div>
              <div>
                <p className="text-slate-400">Type</p>
                <p>{selectedDoc.file_type || parseFileType(selectedDoc.document_filename)}</p>
              </div>
              <div>
                <p className="text-slate-400">Extracted chars</p>
                <p>{selectedDoc.char_count ?? '—'}</p>
              </div>
            </div>
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              Live preview is unavailable for this file source. You can still ask questions against indexed content.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({
  msg,
  onRetry,
  onRegenerate,
}: {
  msg: ChatMessage
  onRetry?: (id: string) => void
  onRegenerate?: (id: string) => void
}) {
  const [excerptOpen, setExcerptOpen] = useState(false)
  const isUser = msg.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
          AI
        </div>
      )}

      <div className={`flex max-w-[80%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser
              ? 'rounded-tr-sm bg-indigo-600 text-white'
              : msg.status === 'error'
                ? 'rounded-tl-sm border border-red-200 bg-red-50 text-red-700'
                : msg.status === 'partial'
                  ? 'rounded-tl-sm border border-amber-200 bg-amber-50 text-amber-800'
                  : 'rounded-tl-sm border border-slate-200 bg-white text-slate-700 shadow-sm'
            }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          )}
          {msg.status === 'streaming' && (
            <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-indigo-400" />
          )}
        </div>

        {msg.relevant_excerpt && (
          <div>
            <button
              onClick={() => setExcerptOpen((v) => !v)}
              className="px-1 text-xs text-slate-400 transition hover:text-slate-600"
            >
              {excerptOpen ? 'Hide source excerpt' : 'Show source excerpt'}
              {msg.page_hint ? ` (page ${msg.page_hint})` : ''}
            </button>
            {excerptOpen && (
              <blockquote className="mt-1 rounded-r-lg border-l-2 border-indigo-200 bg-slate-50 py-2 pl-3 pr-3 text-xs italic text-slate-500">
                {msg.relevant_excerpt}
              </blockquote>
            )}
          </div>
        )}

        {!isUser && (msg.status === 'error' || msg.status === 'partial') && (
          <div className="flex items-center gap-2">
            {onRetry && (
              <button
                onClick={() => onRetry(msg.id)}
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Retry
              </button>
            )}
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(msg.id)}
                className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              >
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionWorkspace({
  sessionId,
  localPreviewDocs,
  onSessionMetaUpdate,
}: {
  sessionId: string
  localPreviewDocs: LocalPreviewDoc[]
  onSessionMetaUpdate: (next: Partial<QASessionRecord> & { session_id: string }) => void
}) {
  const [sessionMeta, setSessionMeta] = useState<QASessionRecord | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => scrollToBottom(), [messages])

  const loadSession = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getQASessionAPI(sessionId, 1, 100)
      const meta: QASessionRecord = {
        session_id: data.session_id,
        name: data.name,
        user_id: data.user_id,
        documents: data.documents || [],
        created_at: data.created_at,
        updated_at: data.updated_at,
      }
      setSessionMeta(meta)
      onSessionMetaUpdate(meta)
      setMessages((data.records || []).map(mapMessageRecord))
    } catch (e: any) {
      setNotice(e?.message || 'Failed to load session.')
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }, [onSessionMetaUpdate, sessionId])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  const runStream = async (
    updaterId: string,
    runner: (callbacks: {
      onChunk: (text: string) => void
      onEvent: (event: 'done' | 'partial' | 'error', data: Record<string, any> | null) => void
    }) => Promise<void>,
  ) => {
    setIsStreaming(true)
    setNotice(null)
    try {
      await runner({
        onChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === updaterId ? { ...m, content: m.content + chunk } : m)),
          )
        },
        onEvent: (event, data) => {
          if (event === 'done') {
            if (data?.data?.status === 'no_failures') {
              setNotice('No failed or partial answers found to retry.')
            }
            setMessages((prev) =>
              prev.map((m) => (m.id === updaterId ? { ...m, status: 'done' } : m)),
            )
          } else if (event === 'partial') {
            const msg =
              data?.message ||
              'Answer was cut short due to a provider/network issue. Try regenerate.'
            setMessages((prev) =>
              prev.map((m) =>
                m.id === updaterId ? { ...m, status: 'partial', content: m.content || msg } : m,
              ),
            )
          } else if (event === 'error') {
            const msg = data?.message || 'Streaming failed.'
            setMessages((prev) =>
              prev.map((m) =>
                m.id === updaterId ? { ...m, status: 'error', content: m.content || msg } : m,
              ),
            )
          }
        },
      })
      setTimeout(() => {
        loadSession()
      }, 300)
    } catch (e: any) {
      const msg = e?.message || 'Streaming request failed.'
      setMessages((prev) =>
        prev.map((m) => (m.id === updaterId ? { ...m, status: 'error', content: msg } : m)),
      )
      setNotice(msg)
    } finally {
      setIsStreaming(false)
    }
  }

  const sendMessage = async () => {
    const question = input.trim()
    if (!question || isStreaming) return

    setInput('')

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: question,
      status: 'done',
    }
    const assistantMsgId = `tmp-${uuidv4()}`
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      status: 'streaming',
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])

    await runStream(assistantMsgId, (callbacks) => askQAAPI(sessionId, question, callbacks))
  }

  const retryMessage = async (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, content: '', status: 'streaming' } : m)),
    )
    await runStream(messageId, (callbacks) => retryMessageAPI(messageId, callbacks))
  }

  const regenerateMessage = async (messageId: string) => {
    const reason = window.prompt('Regeneration reason (min 3 chars):', 'Please provide a more specific answer with exact clauses.')
    if (!reason || reason.trim().length < 3) return
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, content: '', status: 'streaming' } : m)),
    )
    await runStream(messageId, (callbacks) =>
      regenerateMessageAPI(messageId, reason.trim(), callbacks),
    )
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 bg-slate-50 p-4 xl:grid-cols-[1.1fr_1fr]">
      <DocumentPreviewPanel session={sessionMeta} localDocs={localPreviewDocs} />

      <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <p className="text-sm font-bold text-slate-800">Q&A Assistant</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {sessionMeta?.name || 'Ask questions from the document context'}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50 p-5">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-slate-700">No messages yet</p>
              <p className="mt-1 text-sm text-slate-400">Ask your first question to start the conversation.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onRetry={msg.role === 'assistant' ? retryMessage : undefined}
                onRegenerate={msg.role === 'assistant' ? regenerateMessage : undefined}
              />
            ))
          )}

          {notice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              {notice}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-100 bg-white p-4">
          <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition focus-within:border-indigo-300">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask a question about this session..."
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`
              }}
              className="min-h-[24px] max-h-[120px] flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              disabled={isStreaming}
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming || !input.trim()}
              className="h-9 w-9 flex-shrink-0 rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isStreaming ? '...' : '↗'}
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">Enter to send, Shift+Enter for newline</p>
        </div>
      </div>
    </div>
  )
}

function QAPage() {
  const [sessions, setSessions] = useState<QASessionRecord[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [showNewSession, setShowNewSession] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [localPreviewMap, setLocalPreviewMap] = useState<Record<string, LocalPreviewDoc[]>>({})

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true)
    try {
      const data = await getQASessionsAPI(SESSION_USER_ID, 1, 50)
      setSessions(data.records || [])
    } catch {
      setSessions([])
    } finally {
      setIsLoadingSessions(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const handleRenameSession = useCallback(async (id: string, name: string) => {
    const updated = await renameQASessionAPI(id, name)
    setSessions((prev) =>
      prev.map((s) => (s.session_id === id ? { ...s, name: updated.name || name } : s)),
    )
  }, [])

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteQASessionAPI(id)
      setSessions((prev) => prev.filter((s) => s.session_id !== id))
      if (activeSessionId === id) setActiveSessionId(null)
    },
    [activeSessionId],
  )

  const handleSessionCreated = useCallback(
    async (session: QASessionRecord, previews: LocalPreviewDoc[], requestedName: string) => {
      if (requestedName) {
        try {
          const renamed = await renameQASessionAPI(session.session_id, requestedName)
          session = { ...session, name: renamed.name || requestedName }
        } catch {
          session = { ...session, name: requestedName }
        }
      }

      setLocalPreviewMap((prev) => ({ ...prev, [session.session_id]: previews }))
      setSessions((prev) => [session, ...prev])
      setActiveSessionId(session.session_id)
      setShowNewSession(false)
    },
    [],
  )

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} flex-shrink-0 overflow-hidden border-r border-slate-100 transition-all duration-300`}>
        <div className="flex h-full w-72 flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <h2 className="text-sm font-bold text-slate-700">Sessions</h2>
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
            >
              ←
            </button>
          </div>
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={(id) => {
              setShowNewSession(false)
              setActiveSessionId(id)
            }}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onCreateSession={() => {
              setShowNewSession(true)
              setActiveSessionId(null)
            }}
            isLoading={isLoadingSessions}
          />
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-20 z-10 rounded-r-lg border border-l-0 border-slate-200 bg-white px-2 py-2 text-slate-500 shadow-sm transition hover:bg-slate-50"
          >
            →
          </button>
        )}

        {showNewSession || !activeSessionId ? (
          <NewSessionPanel onCreated={handleSessionCreated} />
        ) : (
          <SessionWorkspace
            key={activeSessionId}
            sessionId={activeSessionId}
            localPreviewDocs={localPreviewMap[activeSessionId] || []}
            onSessionMetaUpdate={(next) => {
              setSessions((prev) =>
                prev.map((s) => (s.session_id === next.session_id ? { ...s, ...next } : s)),
              )
            }}
          />
        )}
      </div>
    </div>
  )
}

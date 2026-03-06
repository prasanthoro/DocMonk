import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { v4 as uuidv4 } from 'uuid'
import {
  createQASessionAPI,
  getQASessionsAPI,
  getQASessionAPI,
  deleteQASessionAPI,
  renameQASessionAPI,
  askQAAPI,
  retryMessageAPI,
} from '../lib/api'

export const Route = createFileRoute('/qa')({ component: QAPage })

// A stable "user id" stored in memory for this session
const SESSION_USER_ID = 'docmonk-user-' + Math.random().toString(36).slice(2)

interface QASession {
  _id: string
  name: string
  created_at?: string
  documents?: Array<{ document_filename: string }>
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  relevant_excerpt?: string
  page_hint?: string | number
  status?: 'streaming' | 'done' | 'error' | 'partial'
  timestamp?: number
}

// Simple markdown renderer
function renderMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="inline-code">$1</code>')
    .replace(/\n/g, '<br/>')
}

function MessageBubble({
  msg,
  onRetry,
}: {
  msg: Message
  onRetry?: (id: string) => void
}) {
  const [excerptOpen, setExcerptOpen] = useState(false)
  const isUser = msg.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-3`}>
      {!isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold mt-1">
          AI
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : msg.status === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200 rounded-tl-sm'
              : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
            }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
          )}

          {msg.status === 'streaming' && (
            <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-0.5 rounded-sm" />
          )}
        </div>

        {/* Relevant excerpt */}
        {msg.relevant_excerpt && (
          <div className="w-full">
            <button
              onClick={() => setExcerptOpen(!excerptOpen)}
              className="text-xs text-slate-400 flex items-center gap-1 px-1 hover:text-slate-600 transition"
            >
              <svg
                width="10" height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ transform: excerptOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              {excerptOpen ? 'Hide' : 'Show'} source excerpt
              {msg.page_hint && ` (page ${msg.page_hint})`}
            </button>
            {excerptOpen && (
              <blockquote className="mt-1 border-l-2 border-indigo-200 pl-3 text-xs text-slate-500 italic bg-slate-50 rounded-r-lg py-2 pr-3">
                {msg.relevant_excerpt}
              </blockquote>
            )}
          </div>
        )}

        {/* Retry button for errors */}
        {msg.status === 'error' && onRetry && (
          <button
            onClick={() => onRetry(msg.id)}
            className="text-xs font-semibold text-red-600 flex items-center gap-1 hover:text-red-800 transition px-1"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
            Retry
          </button>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold mt-1">
          You
        </div>
      )}
    </div>
  )
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
  sessions: QASession[]
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, name: string) => void
  onCreateSession: () => void
  isLoading: boolean
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const startRename = (session: QASession) => {
    setRenamingId(session._id)
    setRenameValue(session.name)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  const commitRename = async (id: string) => {
    if (renameValue.trim() && renameValue !== sessions.find((s) => s._id === id)?.name) {
      await onRenameSession(id, renameValue.trim())
    }
    setRenamingId(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* New session button */}
      <div className="p-4 border-b border-slate-100">
        <button
          onClick={onCreateSession}
          className="w-full rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Session
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
          </div>
        ) : sessions?.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-8">No sessions yet</p>
        ) : (
          sessions?.map((session) => (
            <div
              key={session._id}
              className={`group relative rounded-xl px-3 py-3 cursor-pointer transition ${activeSessionId === session._id
                ? 'bg-indigo-50 border border-indigo-100'
                : 'hover:bg-slate-50'
                }`}
              onClick={() => onSelectSession(session._id)}
              onDoubleClick={() => startRename(session)}
            >
              {renamingId === session._id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(session._id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(session._id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-lg border border-indigo-300 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              ) : (
                <>
                  <p className={`text-sm font-medium truncate ${activeSessionId === session._id ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {session.name || 'Untitled Session'}
                  </p>
                  {session.documents && session.documents.length > 0 && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {session.documents[0].document_filename}
                      {session.documents.length > 1 && ` +${session.documents.length - 1}`}
                    </p>
                  )}
                </>
              )}

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteSession(session._id)
                }}
                className="absolute right-2 top-2.5 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition"
                title="Delete session"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function NewSessionPanel({ onCreated }: { onCreated: (session: QASession) => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [sessionName, setSessionName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1] || result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const createSession = async () => {
    if (files.length === 0) {
      setError('Please upload at least one document.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const documents = await Promise.all(
        files.map(async (file) => ({
          document_id: uuidv4(),
          s3_download_url: `data:application/octet-stream;base64,${await fileToBase64(file)}`,
          document_filename: file.name,
        }))
      )

      const session = await createQASessionAPI({
        user_id: SESSION_USER_ID,
        documents,
      })

      onCreated(session)
    } catch (e: any) {
      setError(e?.message || 'Failed to create session. Check your API configuration.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 max-w-lg mx-auto">
      <div className="w-full space-y-5">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Start a new Q&A session</h2>
          <p className="text-sm text-slate-500">Upload documents and ask questions in plain English</p>
        </div>

        <input
          type="text"
          placeholder="Session name (optional)"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
        />

        <div
          {...getRootProps()}
          className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition ${isDragActive
            ? 'border-purple-400 bg-purple-50'
            : 'border-slate-200 bg-slate-50 hover:border-purple-300 hover:bg-purple-50/50'
            }`}
        >
          <input {...getInputProps()} />
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600 mb-3 mx-auto">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">
            {isDragActive ? 'Drop files here' : 'Drop documents here'}
          </p>
          <p className="text-xs text-slate-400">PDF, DOCX, DOC, TXT — multiple files supported</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                <svg className="text-slate-400 flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="flex-1 text-sm text-slate-700 truncate">{file.name}</span>
                <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-slate-300 hover:text-red-500 transition"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
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
          className="w-full rounded-xl bg-purple-600 px-6 py-3.5 text-base font-bold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
        >
          {isCreating ? (
            <>
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              Creating session...
            </>
          ) : (
            <>
              Start Session
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function ChatPanel({
  sessionId,
  onBack,
}: {
  sessionId: string
  onBack: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load session history
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoadingHistory(true)
      try {
        const data = await getQASessionAPI(sessionId)
        const history: Message[] = (data.messages || data.history || []).map((m: any) => ({
          id: m._id || uuidv4(),
          role: m.role || (m.is_user ? 'user' : 'assistant'),
          content: m.content || m.message || '',
          relevant_excerpt: m.relevant_excerpt,
          page_hint: m.page_hint,
          status: 'done',
          timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
        }))
        setMessages(history)
      } catch (e) {
        // Session may be brand new
        setMessages([])
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadHistory()
  }, [sessionId])

  const sendMessage = () => {
    const question = input.trim()
    if (!question || isStreaming) return

    setInput('')

    // Add user message
    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: question,
      status: 'done',
      timestamp: Date.now(),
    }

    // Add placeholder assistant message
    const assistantMsgId = uuidv4()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    askQAAPI(
      sessionId,
      question,
      (chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: m.content + chunk }
              : m
          )
        )
      },
      () => {
        setIsStreaming(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, status: 'done' } : m
          )
        )
      },
      (err) => {
        setIsStreaming(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: err || 'An error occurred.', status: 'error' }
              : m
          )
        )
      }
    )
  }

  const handleRetry = async (messageId: string) => {
    try {
      const response = await retryMessageAPI(messageId)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: response.content || '', status: 'done' }
            : m
        )
      )
    } catch (e) {
      // silently fail
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 bg-white">
        <button
          onClick={onBack}
          className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-700">Document Q&A</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-full border-2 border-purple-300 border-t-purple-600 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-700 mb-2">Ask anything about your documents</h3>
            <p className="text-sm text-slate-400 max-w-xs">
              Ask questions in plain English and get instant AI-powered answers with source references.
            </p>

            {/* Suggested questions */}
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[
                'What are the payment terms?',
                'When does this contract expire?',
                'What are the termination conditions?',
                'Who are the parties involved?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus() }}
                  className="rounded-full border border-purple-100 bg-white px-4 py-2 text-xs font-medium text-purple-600 hover:bg-purple-50 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onRetry={msg.status === 'error' ? handleRetry : undefined}
              />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 bg-white p-4">
        <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-100 transition">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents... (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none min-h-[24px] max-h-[120px]"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`
            }}
            disabled={isStreaming}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="flex-shrink-0 h-9 w-9 rounded-xl bg-purple-600 flex items-center justify-center text-white transition hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

function QAPage() {
  const [sessions, setSessions] = useState<QASession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [showNewSession, setShowNewSession] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const loadSessions = async () => {
    setIsLoadingSessions(true)
    try {
      const data = await getQASessionsAPI(SESSION_USER_ID)
      setSessions(data.sessions || data || [])
    } catch {
      setSessions([])
    } finally {
      setIsLoadingSessions(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id)
    setShowNewSession(false)
  }

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteQASessionAPI(id)
      setSessions((prev) => prev.filter((s) => s._id !== id))
      if (activeSessionId === id) setActiveSessionId(null)
    } catch {
      // silently fail
    }
  }

  const handleRenameSession = async (id: string, name: string) => {
    try {
      await renameQASessionAPI(id, name)
      setSessions((prev) =>
        prev.map((s) => (s._id === id ? { ...s, name } : s))
      )
    } catch {
      // silently fail
    }
  }

  const handleSessionCreated = (session: QASession) => {
    setSessions((prev) => [session, ...prev])
    setActiveSessionId(session._id)
    setShowNewSession(false)
  }

  const handleCreateNew = () => {
    setShowNewSession(true)
    setActiveSessionId(null)
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} flex-shrink-0 border-r border-slate-100 overflow-hidden transition-all duration-300`}>
        <div className="h-full w-72">
          <div className="border-b border-slate-100 px-4 py-3.5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">Sessions</h2>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
          </div>
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onCreateSession={handleCreateNew}
            isLoading={isLoadingSessions}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-20 z-10 rounded-r-lg border border-l-0 border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 transition shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {showNewSession || (!activeSessionId && !showNewSession) ? (
          <NewSessionPanel onCreated={handleSessionCreated} />
        ) : activeSessionId ? (
          <ChatPanel
            key={activeSessionId}
            sessionId={activeSessionId}
            onBack={() => setActiveSessionId(null)}
          />
        ) : null}
      </div>
    </div>
  )
}

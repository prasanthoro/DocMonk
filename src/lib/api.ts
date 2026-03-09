const BASE_URL =
  (import.meta as any).env?.VITE_API_URL ||
  "https://docmonk-production.up.railway.app";

const parseJsonSafe = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const extractErrorMessage = (payload: any, fallback: string) => {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload?.message && typeof payload.message === "string")
    return payload.message;
  return fallback;
};

export const analyzeAPI = async (payload: {
  document_base64: string;
  document_filename: string;
  clauses: Array<{
    id: string;
    category: string;
    title: string;
    value: string;
  }>;
}) => {
  const res = await fetch(`${BASE_URL}/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getJobAPI = async (jobId: string) => {
  const res = await fetch(`${BASE_URL}/v1/jobs/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const resumeJobAPI = async (jobId: string) => {
  const res = await fetch(`${BASE_URL}/v1/jobs/${jobId}/resume`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// QA APIs
export interface QADocument {
  document_id: string;
  document_filename: string;
  file_type?: string;
  char_count?: number;
}

export interface QASessionRecord {
  session_id: string;
  name: string;
  user_id: string;
  documents: QADocument[];
  created_at?: string;
  updated_at?: string;
}

export interface QAMessageRecord {
  message_id: string;
  role: "user" | "assistant";
  content: string;
  relevant_excerpt?: string;
  page_hint?: string | number;
  created_at?: string;
  updated_at?: string;
}

export interface QAPaginationInfo {
  total_records: number;
  total_pages: number;
  page_size: number;
  current_page: number;
  next_page: number | null;
  prev_page: number | null;
}

type QAEnvelope<T> = {
  status: number;
  success: boolean;
  message: string;
  data: T;
};

const parseQAEnvelope = async <T>(
  res: Response,
  fallback: string,
): Promise<QAEnvelope<T>> => {
  const payload = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, fallback));
  }
  return payload as QAEnvelope<T>;
};

export const createQASessionAPI = async (payload: {
  user_id: string;
  documents: Array<{
    document_id: string;
    document_base64: string;
    document_filename: string;
  }>;
}) => {
  const res = await fetch(`${BASE_URL}/v1/qa/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const envelope = await parseQAEnvelope<QASessionRecord>(
    res,
    "Failed to create QA session.",
  );
  return envelope.data;
};

export const getQASessionsAPI = async (
  userId: string,
  page = 1,
  pageSize = 20,
) => {
  const url = new URL(`${BASE_URL}/v1/qa/sessions`);
  url.searchParams.set("user_id", userId);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));

  const res = await fetch(url.toString());
  const envelope = await parseQAEnvelope<{
    user_id: string;
    pagination_info: QAPaginationInfo;
    records: QASessionRecord[];
  }>(res, "Failed to fetch QA sessions.");

  return envelope.data;
};

export const getQASessionAPI = async (
  sessionId: string,
  page = 1,
  pageSize = 50,
) => {
  const res = await fetch(
    `${BASE_URL}/v1/qa/sessions/${sessionId}?page=${page}&page_size=${pageSize}`,
  );
  const envelope = await parseQAEnvelope<{
    session_id: string;
    name: string;
    user_id: string;
    documents: QADocument[];
    created_at?: string;
    updated_at?: string;
    pagination_info: QAPaginationInfo;
    records: QAMessageRecord[];
  }>(res, "Failed to fetch QA session details.");

  return envelope.data;
};

export const deleteQASessionAPI = async (sessionId: string) => {
  const res = await fetch(`${BASE_URL}/v1/qa/sessions/${sessionId}`, {
    method: "DELETE",
  });
  const envelope = await parseQAEnvelope<{ session_id: string }>(
    res,
    "Failed to delete QA session.",
  );
  return envelope.data;
};

export const renameQASessionAPI = async (sessionId: string, name: string) => {
  const res = await fetch(`${BASE_URL}/v1/qa/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const envelope = await parseQAEnvelope<{
    session_id: string;
    name: string;
    updated_at?: string;
  }>(res, "Failed to rename QA session.");
  return envelope.data;
};

type SSETerminalEvent = "done" | "partial" | "error";
type SSEEventData = Record<string, any> | null;

interface SSECallbacks {
  onChunk: (text: string) => void;
  onEvent: (event: SSETerminalEvent, data: SSEEventData) => void;
}

const decodeSSEChunk = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
};

const parseSSEJson = (raw: string): SSEEventData => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const streamSSE = async (
  url: string,
  body: Record<string, any>,
  callbacks: SSECallbacks,
) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const payload = await parseJsonSafe(res);
    throw new Error(extractErrorMessage(payload, "Streaming request failed."));
  }

  if (contentType.includes("application/json")) {
    const payload = await parseJsonSafe(res);
    if ((payload as any)?.data?.status === "no_failures") {
      callbacks.onEvent("done", payload as Record<string, any>);
      return;
    }
    throw new Error(extractErrorMessage(payload, "Unexpected JSON response."));
  }

  if (!res.body) {
    throw new Error("Streaming response body is empty.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        currentEvent = null;
        continue;
      }
      if (line.startsWith(":")) continue;

      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
        continue;
      }

      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (!payload) continue;

      if (
        currentEvent === "done" ||
        currentEvent === "partial" ||
        currentEvent === "error"
      ) {
        callbacks.onEvent(currentEvent, parseSSEJson(payload));
        return;
      }

      const chunk = decodeSSEChunk(payload);
      if (chunk) callbacks.onChunk(chunk);
    }
  }

  callbacks.onEvent("done", null);
};

export const askQAAPI = async (
  sessionId: string,
  question: string,
  callbacks: SSECallbacks,
) => {
  return streamSSE(
    `${BASE_URL}/v1/qa/sessions/${sessionId}/ask`,
    { question },
    callbacks,
  );
};

export const retryMessageAPI = async (
  messageId: string,
  callbacks: SSECallbacks,
) => {
  return streamSSE(
    `${BASE_URL}/v1/qa/messages/${messageId}/retry`,
    {},
    callbacks,
  );
};

export const regenerateMessageAPI = async (
  messageId: string,
  reason: string,
  callbacks: SSECallbacks,
) => {
  return streamSSE(
    `${BASE_URL}/v1/qa/messages/${messageId}/regenerate`,
    { reason },
    callbacks,
  );
};

const BASE_URL =
  (import.meta as any).env?.VITE_API_URL ||
  "https://docmonk-production.up.railway.app";

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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getQASessionsAPI = async (userId: string) => {
  const res = await fetch(`${BASE_URL}/v1/qa/sessions?user_id=${userId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const getQASessionAPI = async (sessionId: string, page = 1) => {
  const res = await fetch(
    `${BASE_URL}/v1/qa/sessions/${sessionId}?page=${page}&page_size=50`,
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const deleteQASessionAPI = async (sessionId: string) => {
  const res = await fetch(`${BASE_URL}/v1/qa/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const renameQASessionAPI = async (sessionId: string, name: string) => {
  const res = await fetch(`${BASE_URL}/v1/qa/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const askQAAPI = (
  sessionId: string,
  question: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) => {
  fetch(`${BASE_URL}/v1/qa/sessions/${sessionId}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  })
    .then(async (res) => {
      if (!res.ok) {
        onError(await res.text());
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            try {
              const parsed = JSON.parse(data);
              if (parsed.success !== undefined) {
                onDone();
                return;
              }
              onChunk(JSON.parse(`"${data.slice(1, -1)}"`));
            } catch {
              if (data) onChunk(data);
            }
          }
          if (line.startsWith("event: done")) {
            onDone();
            return;
          }
          if (line.startsWith("event: error")) {
            onError("Stream error");
            return;
          }
        }
      }
      onDone();
    })
    .catch((e) => onError(String(e)));
};

export const retryMessageAPI = async (messageId: string) => {
  const res = await fetch(`${BASE_URL}/v1/qa/messages/${messageId}/retry`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const regenerateMessageAPI = async (
  messageId: string,
  reason: string,
) => {
  const res = await fetch(
    `${BASE_URL}/v1/qa/messages/${messageId}/regenerate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

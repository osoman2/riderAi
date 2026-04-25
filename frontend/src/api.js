const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function checkHealth() {
  try {
    const res = await fetch(`${BASE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data;
  } catch {
    return false;
  }
}

export async function analyzeSession(videoFile, sport, opts = {}) {
  const formData = new FormData();
  formData.append('video', videoFile);
  formData.append('sport', sport);
  if (opts.useGroq) formData.append('use_groq', 'true');
  if (opts.groqApiKey) formData.append('groq_api_key', opts.groqApiKey);
  if (opts.groqModel) formData.append('groq_model', opts.groqModel);

  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(text);
  }
  return res.json();
}

export async function listSessions() {
  const res = await fetch(`${BASE}/sessions`);
  if (!res.ok) throw new Error('Failed to load sessions');
  return res.json();
}

export async function getSession(id) {
  const res = await fetch(`${BASE}/sessions/${id}`);
  if (!res.ok) throw new Error('Session not found');
  return res.json();
}

export function videoUrl(sessionId, kind) {
  return `${BASE}/sessions/${sessionId}/video/${kind}`;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `${response.status} ${response.statusText}`);
  }
  return data;
}

export async function fetchAmapRegeocode(location) {
  const params = new URLSearchParams({
    lon: String(location.lon),
    lat: String(location.lat),
  });
  return requestJson(`/api/amap/regeocode?${params.toString()}`, {
    method: 'GET',
  });
}

export async function requestAiExplanation(payload) {
  return requestJson('/api/explain', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function requestAssistantReply(payload) {
  return requestAiExplanation(payload);
}

export async function saveReport(payload) {
  return requestJson('/api/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

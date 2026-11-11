// The dashboard is served by the same server as the API, so plain relative
// paths work in production and through the Vite proxy in development.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const listeners = new Set();
/** Lets the auth gate react when any request comes back 401. */
export function onUnauthorized(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function request(path, { body, signal, method = 'GET' } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      signal,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Can’t reach the QRTrack server. Is it running?', 0);
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) listeners.forEach((fn) => fn());
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }

  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  login: (password) => request('/api/auth/login', { method: 'POST', body: { password } }),
  logout: () => request('/api/auth/logout', { method: 'POST', body: {} }),

  listQRs: (options) => request('/api/qr', options),
  getQR: (id, options) => request(`/api/qr/${encodeURIComponent(id)}`, options),
  createQR: (body) => request('/api/qr', { method: 'POST', body }),
  createBulk: (items, style) => request('/api/qr/bulk', { method: 'POST', body: { items, style } }),
  updateQR: (id, body) => request(`/api/qr/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  deleteQR: (id) => request(`/api/qr/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getTimeline: (id, days, options) =>
    request(`/api/qr/${encodeURIComponent(id)}/timeline?days=${days}`, options),
  getScans: (id, limit, options) =>
    request(`/api/qr/${encodeURIComponent(id)}/scans?limit=${limit}`, options),
  getBreakdown: (id, options) => request(`/api/qr/${encodeURIComponent(id)}/breakdown`, options),
};

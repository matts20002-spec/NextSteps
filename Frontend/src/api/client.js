// Thin wrapper around fetch() so every call automatically:
//   - sends JSON
//   - attaches the JWT (if we have one) as an Authorization header
//   - throws a real Error (with the server's message) on non-2xx responses
//
// This is intentionally simple -- no interceptors, no query-caching library
// -- so it's easy to trace exactly what happens on every request. There's
// no form-data variant: résumé uploads go straight from the browser to a
// presigned S3 URL, never through this API (see JobDetail.jsx), so every
// request/response body here is JSON.

import { API_BASE } from './config.js';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content has no body to parse.
  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  get: (path, token) => request(path, { method: 'GET', token }),
  post: (path, body, token) => request(path, { method: 'POST', body, token }),
  put: (path, body, token) => request(path, { method: 'PUT', body, token }),
  del: (path, token) => request(path, { method: 'DELETE', token }),
};

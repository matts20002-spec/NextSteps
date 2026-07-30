// Thin wrapper around fetch() so every call automatically:
//   - sends JSON
//   - attaches the JWT (if we have one) as an Authorization header
//   - throws a real Error (with the server's message) on non-2xx responses
//
// This is intentionally simple -- no interceptors, no query-caching library
// -- so students can trace exactly what happens on every request.

async function request(path, { method = 'GET', body, token, isFormData = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
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
  postForm: (path, formData, token) => request(path, { method: 'POST', body: formData, token, isFormData: true }),
};

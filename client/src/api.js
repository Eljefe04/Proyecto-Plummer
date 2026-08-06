// En desarrollo local (npm run dev), VITE_API_URL queda vacio y las
// peticiones van a '/api', que Vite redirige al backend local via proxy
// (ver vite.config.js). En produccion (Netlify), VITE_API_URL apunta
// directo a la URL publica del backend en Render.
const BASE_URL = `${import.meta.env.VITE_API_URL || ''}/api`;

function getToken() {
  return sessionStorage.getItem('plummer_token');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['x-session-token'] = token;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export { getToken };

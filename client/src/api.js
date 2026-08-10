// En desarrollo local (npm run dev), VITE_API_URL queda vacio y las
// peticiones van a '/api', que Vite redirige al backend local via proxy
// (ver vite.config.js). En produccion (Netlify), VITE_API_URL apunta
// directo a la URL publica del backend en Render.
const BASE_URL = `${import.meta.env.VITE_API_URL || ''}/api`;

function getToken() {
  return sessionStorage.getItem('plummer_token');
}

// ------------------------------------------------------------
// Manejo centralizado del 401.
//
// ANTES: si el servidor reiniciaba, el token guardado quedaba muerto.
// El navegador seguia creyendo que la sesion estaba viva, cada pedido
// fallaba y las pantallas quedaban vacias sin explicacion.
//
// AHORA: cuando llega un 401 con codigo de sesion invalida, se avisa
// una sola vez a la aplicacion para que cierre sesion prolijamente y
// vuelva al login con un mensaje claro.
// ------------------------------------------------------------
let alSesionVencida = null;
let yaAvisado = false;

export function registrarManejadorSesionVencida(fn) {
  alSesionVencida = fn;
  yaAvisado = false;
}

class ErrorApi extends Error {
  constructor(mensaje, status, codigo) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
  }
}

async function request(path, { method = 'GET', body, timeoutMs = 60000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['x-session-token'] = token;

  // Render en plan gratuito puede tardar ~50 s en despertar: damos margen
  // en vez de que el navegador corte la conexion y parezca un error.
  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controlador.signal,
    });
  } catch (err) {
    clearTimeout(reloj);
    if (err.name === 'AbortError') {
      throw new ErrorApi('El servidor esta tardando en responder. Reintentalo en unos segundos.', 0, 'TIMEOUT');
    }
    throw new ErrorApi('No se pudo conectar con el servidor.', 0, 'SIN_CONEXION');
  }
  clearTimeout(reloj);

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && data.codigo === 'SESION_INVALIDA') {
    if (!yaAvisado && alSesionVencida) {
      yaAvisado = true;
      alSesionVencida();
    }
    throw new ErrorApi('Tu sesion vencio. Volve a iniciar sesion.', 401, 'SESION_INVALIDA');
  }

  if (!res.ok) {
    throw new ErrorApi(data.error || `Error ${res.status}`, res.status, data.codigo);
  }
  return data;
}

/**
 * Espera a que el servicio de Render y la base de Neon esten despiertos.
 * Informa el progreso para poder mostrarlo en pantalla en vez de dejar
 * el boton de login colgado sin explicacion.
 */
export async function despertarServidor(alProgreso = () => {}, intentos = 12) {
  for (let i = 1; i <= intentos; i++) {
    try {
      alProgreso({ intento: i, total: intentos, estado: i === 1 ? 'conectando' : 'despertando' });
      const res = await fetch(`${BASE_URL}/despertar`, { cache: 'no-store' });
      if (res.ok) {
        alProgreso({ intento: i, total: intentos, estado: 'listo' });
        return true;
      }
    } catch {
      // el servicio todavia no responde: reintentamos
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  alProgreso({ intento: intentos, total: intentos, estado: 'falla' });
  return false;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export { getToken, ErrorApi };

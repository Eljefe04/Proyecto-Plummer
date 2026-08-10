// ------------------------------------------------------------
// Autenticacion por token de sesion.
//
// ANTES: las sesiones vivian en un Map() en memoria del proceso.
// Render duerme el servicio a los ~15 minutos sin trafico y lo
// reinicia en cada deploy, asi que ese Map se vaciaba y TODOS los
// usuarios logueados quedaban con un token muerto: el navegador
// seguia creyendo que estaban adentro y cada pedido devolvia 401.
//
// AHORA: la sesion se guarda en la tabla `sesiones` de PostgreSQL.
// Sobrevive reinicios, deploys y siestas de Render. El Map se
// mantiene, pero solo como cache de lectura para no ir a la base
// en cada request; la base es la fuente de verdad.
// ------------------------------------------------------------

const { v4: uuidv4 } = require('uuid');
const db = require('../db/index');

const cache = new Map(); // token -> sesion (solo para velocidad)

const HORAS_VALIDEZ = 12;

function aSesion(fila) {
  if (!fila) return null;
  return {
    usuarioId: fila.usuario_id,
    usuario: fila.usuario,
    rol: fila.rol,
    nombreCompleto: fila.nombre_completo,
    medicoId: fila.medico_id || null,
    especialidad: fila.especialidad || null,
  };
}

async function crearSesion(usuarioRow, especialidad = null) {
  const token = uuidv4();

  await db.prepare(`
    INSERT INTO sesiones (token, usuario_id, usuario, rol, nombre_completo, medico_id, especialidad)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    token,
    usuarioRow.id,
    usuarioRow.usuario,
    usuarioRow.rol,
    usuarioRow.nombre_completo,
    usuarioRow.medico_id || null,
    especialidad,
  );

  const sesion = aSesion({
    usuario_id: usuarioRow.id,
    usuario: usuarioRow.usuario,
    rol: usuarioRow.rol,
    nombre_completo: usuarioRow.nombre_completo,
    medico_id: usuarioRow.medico_id,
    especialidad,
  });

  cache.set(token, sesion);
  return token;
}

async function obtenerSesion(token) {
  if (!token) return null;
  if (cache.has(token)) return cache.get(token);

  const fila = await db.prepare(
    "SELECT * FROM sesiones WHERE token = ? AND ultima_actividad > NOW() - INTERVAL '12 hours'"
  ).get(token);

  const sesion = aSesion(fila);
  if (sesion) cache.set(token, sesion);
  return sesion;
}

async function eliminarSesion(token) {
  cache.delete(token);
  try {
    await db.prepare('DELETE FROM sesiones WHERE token = ?').run(token);
  } catch (err) {
    console.error('[auth] no se pudo borrar la sesion:', err.message);
  }
}

// Refresca la marca de actividad como mucho una vez por minuto por token,
// para no escribir en la base en cada request.
const ultimoRefresco = new Map();
function tocarSesion(token) {
  const ahora = Date.now();
  if (ahora - (ultimoRefresco.get(token) || 0) < 60000) return;
  ultimoRefresco.set(token, ahora);
  db.prepare('UPDATE sesiones SET ultima_actividad = NOW() WHERE token = ?')
    .run(token)
    .catch(() => {});
}

async function middlewareAuth(req, res, next) {
  try {
    const token = req.headers['x-session-token'];
    if (!token) {
      return res.status(401).json({ error: 'No autenticado', codigo: 'SIN_TOKEN' });
    }

    const sesion = await obtenerSesion(token);
    if (!sesion) {
      // El codigo permite que el frontend distinga "tu sesion vencio"
      // de cualquier otro error, y cierre sesion prolijamente.
      return res.status(401).json({ error: 'Sesion invalida o expirada', codigo: 'SESION_INVALIDA' });
    }

    tocarSesion(token);
    req.sesion = sesion;
    req.sesionToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.sesion || !rolesPermitidos.includes(req.sesion.rol)) {
      return res.status(403).json({
        error: 'No tiene permisos para esta accion',
        codigo: 'SIN_PERMISO',
        rolActual: req.sesion ? req.sesion.rol : null,
        rolesRequeridos: rolesPermitidos,
      });
    }
    next();
  };
}

// Limpieza periodica de sesiones vencidas.
setInterval(() => {
  db.prepare("DELETE FROM sesiones WHERE ultima_actividad < NOW() - INTERVAL '12 hours'")
    .run()
    .catch(() => {});
  cache.clear(); // el cache se rellena solo desde la base
}, 60 * 60 * 1000).unref();

module.exports = {
  crearSesion,
  obtenerSesion,
  eliminarSesion,
  middlewareAuth,
  requireRol,
};

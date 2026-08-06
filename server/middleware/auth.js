// Autenticacion simple basada en un token de sesion en memoria.
// Adecuado para un proyecto academico corriendo en red local.
// (No usa JWT ni hashing real - queda documentado como pendiente
// para una version productiva, tal como se aclaro en el prompt original.)

const { v4: uuidv4 } = require('uuid');

const sesiones = new Map(); // token -> { usuarioId, usuario, rol, nombreCompleto, medicoId }

function crearSesion(usuarioRow) {
  const token = uuidv4();
  sesiones.set(token, {
    usuarioId: usuarioRow.id,
    usuario: usuarioRow.usuario,
    rol: usuarioRow.rol,
    nombreCompleto: usuarioRow.nombre_completo,
    medicoId: usuarioRow.medico_id || null,
  });
  return token;
}

function obtenerSesion(token) {
  return sesiones.get(token) || null;
}

function eliminarSesion(token) {
  sesiones.delete(token);
}

function middlewareAuth(req, res, next) {
  const token = req.headers['x-session-token'];
  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const sesion = obtenerSesion(token);
  if (!sesion) {
    return res.status(401).json({ error: 'Sesion invalida o expirada' });
  }
  req.sesion = sesion;
  next();
}

function requireRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.sesion || !rolesPermitidos.includes(req.sesion.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para esta accion' });
    }
    next();
  };
}

module.exports = { crearSesion, obtenerSesion, eliminarSesion, middlewareAuth, requireRol };

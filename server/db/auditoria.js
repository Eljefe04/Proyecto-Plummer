const { v4: uuidv4 } = require('uuid');
const db = require('./index');

/**
 * Registra una accion de auditoria. Se debe llamar desde cada
 * ruta que crea, modifica, elimina o accede a datos sensibles (HCE).
 *
 * @param {object} params
 * @param {string} params.usuario - nombre del usuario logueado
 * @param {string} params.rol - rol del usuario
 * @param {'creacion'|'modificacion'|'eliminacion'|'acceso_hce'|'login'} params.accion
 * @param {string} params.modulo - modulo del sistema (ej: 'pacientes', 'turnos')
 * @param {string} params.descripcion - descripcion legible de la accion
 * @param {string} [params.pacienteId] - id de paciente si aplica
 */
async function registrarAuditoria({ usuario, rol, accion, modulo, descripcion, pacienteId = null }) {
  const stmt = db.prepare(`
    INSERT INTO auditoria (id, usuario, rol, accion, modulo, descripcion, paciente_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  await stmt.run(uuidv4(), usuario, rol || null, accion, modulo, descripcion, pacienteId);
}

module.exports = { registrarAuditoria };

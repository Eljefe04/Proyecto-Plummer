const { v4: uuidv4 } = require('uuid');
const db = require('../db/index');

let ioInstance = null;

/**
 * Registra la instancia de socket.io para poder emitir desde
 * cualquier ruta del sistema sin pasarla por parametro cada vez.
 */
function initNotificaciones(io) {
  ioInstance = io;
}

/**
 * Envia una notificacion en tiempo real a un rol completo (ej: 'laboratorio')
 * o a un medico especifico (ej: medicoId de Cardiologia), y la persiste
 * en la tabla notificaciones para que quien no este conectado la vea
 * apenas entre.
 *
 * @param {object} params
 * @param {string} params.destinoRol - rol destino: 'laboratorio','farmacia','imagenes','enfermeria','quirofano','medico','recepcion'
 * @param {string} [params.destinoMedicoId] - si destinoRol es 'medico', el id puntual del medico
 * @param {string} params.tipo - tipo de evento (ej: 'turno_creado', 'receta_nueva', 'resultado_listo')
 * @param {string} params.titulo
 * @param {string} params.mensaje
 * @param {string} [params.pacienteId]
 */
function emitirNotificacion({ destinoRol, destinoMedicoId = null, tipo, titulo, mensaje, pacienteId = null }) {
  const id = uuidv4();
  const payload = { id, tipo, titulo, mensaje, pacienteId, creado_en: new Date().toISOString() };

  // Persistencia en base de datos: no bloqueamos la emision en vivo por esto,
  // se guarda en segundo plano para que quien no este conectado la vea al entrar.
  db.prepare(`
    INSERT INTO notificaciones (id, destino_rol, destino_medico_id, tipo, titulo, mensaje, paciente_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, destinoRol, destinoMedicoId, tipo, titulo, mensaje, pacienteId)
    .catch((err) => console.error('[notificaciones] error al persistir:', err.message));

  if (!ioInstance) return payload;

  // Sala por rol (ej: todos los que entraron como "laboratorio")
  ioInstance.to(`rol:${destinoRol}`).emit('notificacion', payload);

  // Sala especifica por medico (aislamiento por especialidad/persona)
  if (destinoMedicoId) {
    ioInstance.to(`medico:${destinoMedicoId}`).emit('notificacion', payload);
  }

  return payload;
}

/**
 * Emite un evento de "refrescar datos" a las salas indicadas, para que
 * las terminales conectadas vuelvan a pedir la lista actualizada
 * (turnos, camas, etc.) sin que el usuario tenga que recargar la pagina.
 */
function emitirActualizacion({ salas = [], recurso }) {
  if (!ioInstance) return;
  salas.forEach((sala) => {
    ioInstance.to(sala).emit('actualizar', { recurso, ts: Date.now() });
  });
}

module.exports = { initNotificaciones, emitirNotificacion, emitirActualizacion };

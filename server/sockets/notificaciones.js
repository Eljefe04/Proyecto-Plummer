const { v4: uuidv4 } = require('uuid');
const db = require('../db/index');

let ioInstance = null;

function initNotificaciones(io) {
  ioInstance = io;
}

// ------------------------------------------------------------
// MAPA DESTINO -> SALAS
//
// Este es el arreglo mas importante del modulo. Antes se emitia
// directo a `rol:${destino}`, pero los destinos de derivacion
// ('cardiologia', 'internacion', 'cirugia'...) NO coinciden con
// los 8 roles de login, que son las unicas salas que existen.
//
// Resultado: derivar a Cardiologia, a Internacion o a Cirugia
// emitia una notificacion al vacio. Nadie la recibia nunca.
//
// Ahora cada destino declara explicitamente a que salas va.
// ------------------------------------------------------------
const DESTINO_A_SALAS = {
  // Especialidades clinicas -> la sala general de medicos.
  // Ademas, si se conoce el medico puntual, se agrega su sala propia.
  obstetricia:       ['rol:medico'],
  cardiologia:       ['rol:medico'],
  neurologia:        ['rol:medico'],
  pediatria:         ['rol:medico'],

  // Areas de internacion -> las maneja Enfermeria.
  internacion:       ['rol:enfermeria'],
  terapia_intensiva: ['rol:enfermeria'],

  // Guardia: la admision la hace Recepcion, la atencion Enfermeria.
  guardia:           ['rol:recepcion', 'rol:enfermeria'],

  // Quirofano cubre cirugia y anestesiologia.
  cirugia:           ['rol:quirofano'],
  anestesiologia:    ['rol:quirofano'],

  // Servicios con rol propio.
  laboratorio:       ['rol:laboratorio'],
  imagenes:          ['rol:imagenes'],
  farmacia:          ['rol:farmacia'],
  enfermeria:        ['rol:enfermeria'],
  recepcion:         ['rol:recepcion'],
  quirofano:         ['rol:quirofano'],
  medico:            ['rol:medico'],
  administrador:     ['rol:administrador'],
};

function salasDe(destino) {
  return DESTINO_A_SALAS[destino] || [`rol:${destino}`];
}

/**
 * Envia una notificacion en vivo y la persiste para quien no este conectado.
 */
function emitirNotificacion({
  destinoRol,
  destinoMedicoId = null,
  tipo,
  titulo,
  mensaje,
  pacienteId = null,
  prioridad = 'normal',
}) {
  const id = uuidv4();
  const payload = {
    id,
    tipo,
    titulo,
    mensaje,
    pacienteId,
    prioridad,
    destino: destinoRol,
    creado_en: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO notificaciones (id, destino_rol, destino_medico_id, tipo, titulo, mensaje, paciente_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, destinoRol, destinoMedicoId, tipo, titulo, mensaje, pacienteId)
    .catch((err) => console.error('[notificaciones] error al persistir:', err.message));

  if (!ioInstance) return payload;

  // El administrador supervisa: recibe copia de todo.
  const salas = new Set([...salasDe(destinoRol), 'rol:administrador']);
  salas.forEach((sala) => ioInstance.to(sala).emit('notificacion', payload));

  if (destinoMedicoId) {
    ioInstance.to(`medico:${destinoMedicoId}`).emit('notificacion', payload);
  }

  return payload;
}

/**
 * Avisa a las terminales conectadas que un recurso cambio.
 *
 * MEJORA DE FLUIDEZ: ahora el evento puede viajar CON los datos
 * (parametro `datos`). Antes solo decia "cambio camas" y cada
 * terminal disparaba un GET completo contra Render -> Neon -> vuelta.
 * Ese viaje HTTP era el retraso que se notaba, no el socket.
 * Si mandamos los datos en el propio evento, la pantalla se
 * actualiza sin pedir nada.
 */
function emitirActualizacion({ salas = [], recurso, datos = null, destinos = null }) {
  if (!ioInstance) return;

  const objetivo = new Set(salas);
  if (destinos) destinos.forEach((d) => salasDe(d).forEach((s) => objetivo.add(s)));
  objetivo.add('rol:administrador'); // supervision

  const payload = { recurso, datos, ts: Date.now() };
  objetivo.forEach((sala) => ioInstance.to(sala).emit('actualizar', payload));
}

module.exports = {
  initNotificaciones,
  emitirNotificacion,
  emitirActualizacion,
  DESTINO_A_SALAS,
  salasDe,
};

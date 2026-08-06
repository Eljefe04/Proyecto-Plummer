const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId, parseJsonSafe } = require('./_utils');

const router = express.Router();

router.use(middlewareAuth);

router.get('/', async (req, res, next) => {
  try {
    let rows;
    if (req.sesion.rol === 'medico') {
      rows = await db.prepare(`
        SELECT t.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni
        FROM turnos t
        JOIN pacientes p ON p.id = t.paciente_id
        WHERE t.medico_id = ?
        ORDER BY t.fecha, t.hora
      `).all(req.sesion.medicoId);
    } else {
      rows = await db.prepare(`
        SELECT t.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni,
               m.nombre AS medico_nombre, m.apellido AS medico_apellido, m.especialidad
        FROM turnos t
        JOIN pacientes p ON p.id = t.paciente_id
        JOIN medicos m ON m.id = t.medico_id
        ORDER BY t.fecha DESC, t.hora
      `).all();
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/disponibilidad/:medicoId', async (req, res, next) => {
  try {
    const { fecha } = req.query;
    const medico = await db.prepare(`SELECT * FROM medicos WHERE id = ?`).get(req.params.medicoId);
    if (!medico) return res.status(404).json({ error: 'Medico no encontrado' });

    if (!medico.hora_inicio || !medico.hora_fin || !medico.dias_atencion) {
      return res.json({ agendaConfigurada: false, horarios: [] });
    }

    const diasAtencion = parseJsonSafe(medico.dias_atencion, []);
    const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const diaSolicitado = fecha ? diasSemana[new Date(fecha + 'T00:00:00').getDay()] : null;

    if (fecha && !diasAtencion.map((d) => d.toLowerCase()).includes(diaSolicitado)) {
      return res.json({ agendaConfigurada: true, horarios: [], motivo: 'El medico no atiende ese dia' });
    }

    const duracion = medico.duracion_turno_min || 30;
    const [hIni, mIni] = medico.hora_inicio.split(':').map(Number);
    const [hFin, mFin] = medico.hora_fin.split(':').map(Number);
    const inicioMin = hIni * 60 + mIni;
    const finMin = hFin * 60 + mFin;

    const ocupadosRows = fecha
      ? await db.prepare(`SELECT hora FROM turnos WHERE medico_id = ? AND fecha = ? AND estado != 'cancelado'`)
          .all(req.params.medicoId, fecha)
      : [];
    const ocupados = ocupadosRows.map((r) => r.hora);

    const horarios = [];
    for (let m = inicioMin; m + duracion <= finMin; m += duracion) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const horario = `${hh}:${mm}`;
      if (!ocupados.includes(horario)) horarios.push(horario);
    }

    res.json({ agendaConfigurada: true, horarios, consultorio: medico.consultorio });
  } catch (err) { next(err); }
});

router.post('/', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id || !b.medico_id || !b.fecha || !b.hora) {
      return res.status(400).json({ error: 'Paciente, medico, fecha y hora son obligatorios' });
    }

    const medico = await db.prepare(`SELECT * FROM medicos WHERE id = ?`).get(b.medico_id);
    if (!medico) return res.status(404).json({ error: 'Medico no encontrado' });

    if (!medico.hora_inicio || !medico.hora_fin || !medico.dias_atencion || medico.dias_atencion === '[]') {
      return res.status(400).json({ error: 'Este medico no tiene agenda configurada. No se puede cargar el turno.' });
    }

    const yaOcupado = await db.prepare(`
      SELECT id FROM turnos WHERE medico_id = ? AND fecha = ? AND hora = ? AND estado != 'cancelado'
    `).get(b.medico_id, b.fecha, b.hora);
    if (yaOcupado) {
      return res.status(409).json({ error: 'Ese horario ya esta ocupado para este medico' });
    }

    const id = nuevoId();
    await db.prepare(`
      INSERT INTO turnos (id, paciente_id, medico_id, fecha, hora, modalidad, consultorio, motivo_consulta, creado_por)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      id, b.paciente_id, b.medico_id, b.fecha, b.hora,
      b.modalidad || 'presencial', medico.consultorio || null, b.motivo_consulta || null,
      req.sesion.nombreCompleto
    );

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(b.paciente_id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'turnos',
      descripcion: `Turno creado para ${paciente.nombre} ${paciente.apellido} con Dr./Dra. ${medico.nombre} ${medico.apellido} el ${b.fecha} ${b.hora}`,
      pacienteId: paciente.id,
    });

    emitirNotificacion({
      destinoRol: 'medico',
      destinoMedicoId: medico.id,
      tipo: 'turno_creado',
      titulo: 'Nuevo turno asignado',
      mensaje: `${paciente.nombre} ${paciente.apellido} - ${b.fecha} ${b.hora}`,
      pacienteId: paciente.id,
    });
    emitirActualizacion({ salas: [`medico:${medico.id}`, 'rol:recepcion', 'rol:administrador'], recurso: 'turnos' });

    const row = await db.prepare(`SELECT * FROM turnos WHERE id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put('/:id', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const b = req.body;
    const actual = await db.prepare(`SELECT * FROM turnos WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Turno no encontrado' });

    await db.prepare(`
      UPDATE turnos SET fecha=?, hora=?, modalidad=?, motivo_consulta=?, estado=?
      WHERE id = ?
    `).run(
      b.fecha ?? actual.fecha, b.hora ?? actual.hora, b.modalidad ?? actual.modalidad,
      b.motivo_consulta ?? actual.motivo_consulta, b.estado ?? actual.estado, req.params.id
    );

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'turnos',
      descripcion: `Turno modificado (id ${req.params.id})`,
    });

    emitirActualizacion({ salas: [`medico:${actual.medico_id}`, 'rol:recepcion', 'rol:administrador'], recurso: 'turnos' });

    const row = await db.prepare(`SELECT * FROM turnos WHERE id = ?`).get(req.params.id);
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/:id', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const actual = await db.prepare(`SELECT * FROM turnos WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Turno no encontrado' });

    await db.prepare(`DELETE FROM turnos WHERE id = ?`).run(req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'eliminacion',
      modulo: 'turnos',
      descripcion: `Turno eliminado (id ${req.params.id})`,
    });

    emitirActualizacion({ salas: [`medico:${actual.medico_id}`, 'rol:recepcion', 'rol:administrador'], recurso: 'turnos' });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;

const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId } = require('./_utils');

const router = express.Router();
router.use(middlewareAuth);

// -------------------- CIRUGIAS --------------------
router.get('/cirugias', async (req, res, next) => {
  try {
    const { medico_id } = req.query;
    const rows = medico_id
      ? await db.prepare(`
          SELECT c.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
          FROM cirugias c JOIN pacientes p ON p.id = c.paciente_id
          WHERE c.solicitado_por_medico_id = ? ORDER BY c.fecha_programada
        `).all(medico_id)
      : await db.prepare(`
          SELECT c.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni,
                 m.nombre AS cirujano_nombre, m.apellido AS cirujano_apellido
          FROM cirugias c
          JOIN pacientes p ON p.id = c.paciente_id
          LEFT JOIN medicos m ON m.id = c.cirujano_id
          ORDER BY c.fecha_programada DESC
        `).all();
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/cirugias', requireRol('medico', 'quirofano', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id || !b.tipo_cirugia) {
      return res.status(400).json({ error: 'Paciente y tipo de cirugia son obligatorios' });
    }
    const id = nuevoId();
    const solicitadoPor = req.sesion.rol === 'medico' ? req.sesion.medicoId : (b.solicitado_por_medico_id || null);

    await db.prepare(`
      INSERT INTO cirugias (
        id, paciente_id, tipo_cirugia, caracter, tipo_intervencion, cirujano_id,
        anestesiologo, quirofano, fecha_programada, hora_inicio, duracion_estimada,
        equipo_quirurgico, notas_prequirurgicas, solicitado_por_medico_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, b.paciente_id, b.tipo_cirugia, b.caracter || 'programada', b.tipo_intervencion || 'ambulatoria',
      b.cirujano_id || null, b.anestesiologo || null, b.quirofano || null, b.fecha_programada || null,
      b.hora_inicio || null, b.duracion_estimada || null, b.equipo_quirurgico || null,
      b.notas_prequirurgicas || null, solicitadoPor
    );

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(b.paciente_id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'cirugia',
      descripcion: `Cirugia programada para ${paciente.nombre} ${paciente.apellido}: ${b.tipo_cirugia}`,
      pacienteId: paciente.id,
    });

    emitirNotificacion({
      destinoRol: 'quirofano',
      tipo: 'cirugia_solicitada',
      titulo: b.caracter === 'urgente' ? 'Cirugia URGENTE solicitada' : 'Nueva cirugia programada',
      mensaje: `${paciente.nombre} ${paciente.apellido} - ${b.tipo_cirugia}`,
      pacienteId: paciente.id,
    });
    emitirActualizacion({ salas: ['rol:quirofano'], recurso: 'cirugias' });

    const row = await db.prepare(`SELECT * FROM cirugias WHERE id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.patch('/cirugias/:id/estado', requireRol('quirofano', 'administrador'), async (req, res, next) => {
  try {
    const { estado } = req.body;
    await db.prepare(`UPDATE cirugias SET estado = ? WHERE id = ?`).run(estado, req.params.id);
    emitirActualizacion({ salas: ['rol:quirofano', 'rol:enfermeria'], recurso: 'cirugias' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// -------------------- ANESTESIOLOGIA --------------------
router.get('/fichas-anestesicas', async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT f.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
      FROM fichas_anestesicas f JOIN pacientes p ON p.id = f.paciente_id
      ORDER BY f.creado_en DESC
    `).all();
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/cirugia-pendiente/:pacienteId', async (req, res, next) => {
  try {
    const row = await db.prepare(`
      SELECT * FROM cirugias WHERE paciente_id = ? AND estado = 'programada'
      ORDER BY fecha_programada DESC LIMIT 1
    `).get(req.params.pacienteId);
    res.json(row || null);
  } catch (err) { next(err); }
});

router.post('/fichas-anestesicas', requireRol('quirofano', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id) return res.status(400).json({ error: 'El paciente es obligatorio' });

    const id = nuevoId();
    await db.prepare(`
      INSERT INTO fichas_anestesicas (
        id, paciente_id, cirugia_id, tipo_anestesia, clasificacion_asa, evaluacion_preanestesica
      ) VALUES (?,?,?,?,?,?)
    `).run(id, b.paciente_id, b.cirugia_id || null, b.tipo_anestesia || 'general', b.clasificacion_asa || 'ASA I', b.evaluacion_preanestesica || null);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'anestesiologia',
      descripcion: `Ficha de evaluacion preanestesica creada`,
      pacienteId: b.paciente_id,
    });

    const row = await db.prepare(`SELECT * FROM fichas_anestesicas WHERE id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.patch('/fichas-anestesicas/:id/drogas', requireRol('quirofano', 'administrador'), async (req, res, next) => {
  try {
    const { drogas_fluidos } = req.body;
    const ficha = await db.prepare(`SELECT * FROM fichas_anestesicas WHERE id = ?`).get(req.params.id);
    if (!ficha) return res.status(404).json({ error: 'Ficha no encontrada' });

    await db.prepare(`UPDATE fichas_anestesicas SET drogas_fluidos = ? WHERE id = ?`).run(JSON.stringify(drogas_fluidos), req.params.id);

    for (const d of (drogas_fluidos || [])) {
      if (d.medicamento_id && d.cantidad) {
        await db.prepare(`UPDATE medicamentos SET stock = stock - ? WHERE id = ?`).run(d.cantidad, d.medicamento_id);
        await db.prepare(`
          INSERT INTO dispensaciones (id, paciente_id, medicamento_id, cantidad, indicaciones, dispensado_por)
          VALUES (?,?,?,?,?,?)
        `).run(nuevoId(), ficha.paciente_id, d.medicamento_id, d.cantidad, 'Administrado en anestesiologia', req.sesion.nombreCompleto);
      }
    }

    emitirActualizacion({ salas: ['rol:farmacia'], recurso: 'medicamentos' });

    const row = await db.prepare(`SELECT * FROM fichas_anestesicas WHERE id = ?`).get(req.params.id);
    res.json(row);
  } catch (err) { next(err); }
});

router.patch('/fichas-anestesicas/:id/recuperacion', requireRol('quirofano', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    await db.prepare(`
      UPDATE fichas_anestesicas SET recuperacion_signos_vitales=?, recuperacion_tiempo=?, recuperacion_estado_alta=? WHERE id=?
    `).run(b.recuperacion_signos_vitales || null, b.recuperacion_tiempo || null, b.recuperacion_estado_alta || null, req.params.id);

    const row = await db.prepare(`SELECT * FROM fichas_anestesicas WHERE id = ?`).get(req.params.id);
    res.json(row);
  } catch (err) { next(err); }
});

module.exports = router;

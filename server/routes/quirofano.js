const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { internarPaciente, NOMBRE_SECTOR } = require('./_internacion');
const { nuevoId } = require('./_utils');

// Dias de internacion sugeridos segun complejidad. Es una SUGERENCIA:
// el alta siempre la confirma una persona.
const DIAS_POR_COMPLEJIDAD = { baja: 1, media: 3, alta: 7 };

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
                 p.estado AS paciente_estado,
                 m.nombre AS cirujano_nombre, m.apellido AS cirujano_apellido,
                 a.nombre AS anestesiologo_nombre, a.apellido AS anestesiologo_apellido,
                 s.nombre AS solicitante_nombre, s.apellido AS solicitante_apellido,
                 cam.codigo AS cama_codigo
          FROM cirugias c
          JOIN pacientes p ON p.id = c.paciente_id
          LEFT JOIN medicos m   ON m.id = c.cirujano_id
          LEFT JOIN medicos a   ON a.id = c.anestesiologo_id
          LEFT JOIN medicos s   ON s.id = c.solicitado_por_medico_id
          LEFT JOIN camas  cam  ON cam.id = c.cama_asignada_id
          ORDER BY
            CASE WHEN c.estado = 'solicitada' THEN 0 WHEN c.estado = 'programada' THEN 1 ELSE 2 END,
            CASE WHEN c.caracter = 'urgente' THEN 0 ELSE 1 END,
            c.fecha_programada NULLS FIRST
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

    // Un medico SOLICITA la cirugia; Quirofano es quien despues la programa
    // asignando cirujano, anestesiologo, quirofano y horario. Antes todo
    // caia en una sola lista sin distinguir lo pedido de lo organizado.
    const estadoInicial = req.sesion.rol === 'medico' ? 'solicitada' : 'programada';
    await db.prepare('UPDATE cirugias SET estado = ?, complejidad = ?, anestesiologo_id = ? WHERE id = ?')
      .run(estadoInicial, b.complejidad || 'media', b.anestesiologo_id || null, id);

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

// Programar: Quirofano asigna equipo, sala y horario.
router.patch('/cirugias/:id/programar', requireRol('quirofano'), async (req, res, next) => {
  try {
    const b = req.body;
    const actual = await db.prepare('SELECT * FROM cirugias WHERE id = ?').get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Cirugia no encontrada' });

    if (b.fecha_programada) {
      const hoy = new Date().toISOString().slice(0, 10);
      if (b.fecha_programada < hoy) {
        return res.status(400).json({ error: 'No se puede programar una cirugia en una fecha anterior a hoy.' });
      }
    }

    // Deteccion de choques: antes se podian meter dos cirugias en el
    // mismo quirofano a la misma hora sin que nadie se quejara.
    if (b.quirofano && b.fecha_programada && b.hora_inicio) {
      const choque = await db.prepare(`
        SELECT c.id, p.apellido FROM cirugias c JOIN pacientes p ON p.id = c.paciente_id
        WHERE c.quirofano = ? AND c.fecha_programada = ? AND c.hora_inicio = ?
          AND c.id <> ? AND c.estado NOT IN ('cancelada','finalizada')
      `).get(b.quirofano, b.fecha_programada, b.hora_inicio, req.params.id);
      if (choque) {
        return res.status(409).json({
          error: `El ${b.quirofano} ya tiene una cirugia a las ${b.hora_inicio} (paciente ${choque.apellido}).`,
        });
      }
    }

    await db.prepare(`
      UPDATE cirugias SET cirujano_id = ?, anestesiologo_id = ?, quirofano = ?,
             fecha_programada = ?, hora_inicio = ?, duracion_estimada = ?,
             complejidad = ?, tipo_intervencion = ?, notas_prequirurgicas = ?,
             estado = 'programada'
      WHERE id = ?
    `).run(
      b.cirujano_id || actual.cirujano_id, b.anestesiologo_id || actual.anestesiologo_id,
      b.quirofano || actual.quirofano, b.fecha_programada || actual.fecha_programada,
      b.hora_inicio || actual.hora_inicio, b.duracion_estimada || actual.duracion_estimada,
      b.complejidad || actual.complejidad, b.tipo_intervencion || actual.tipo_intervencion,
      b.notas_prequirurgicas ?? actual.notas_prequirurgicas, req.params.id,
    );

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto, rol: req.sesion.rol, accion: 'modificacion',
      modulo: 'cirugia', descripcion: `Cirugia programada: ${actual.tipo_cirugia}`,
      pacienteId: actual.paciente_id,
    });

    emitirActualizacion({ salas: ['rol:quirofano', 'rol:medico'], recurso: 'cirugias' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Checklist de seguridad quirurgica de la OMS (pausa quirurgica).
router.patch('/cirugias/:id/checklist', requireRol('quirofano'), async (req, res, next) => {
  try {
    await db.prepare('UPDATE cirugias SET checklist_oms = ? WHERE id = ?')
      .run(JSON.stringify(req.body.checklist || {}), req.params.id);
    emitirActualizacion({ salas: ['rol:quirofano'], recurso: 'cirugias' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ------------------------------------------------------------
// Realizar la cirugia.
//
// Antes esto era UNA linea: UPDATE cirugias SET estado. No tocaba camas,
// ni al paciente, ni dejaba registro de que se hizo.
// ------------------------------------------------------------
router.patch('/cirugias/:id/estado', requireRol('quirofano'), async (req, res, next) => {
  try {
    const { estado, parte_quirurgico } = req.body;
    const validos = ['solicitada', 'programada', 'en_curso', 'finalizada', 'cancelada'];
    if (!validos.includes(estado)) {
      return res.status(400).json({ error: `Estado no valido. Debe ser uno de: ${validos.join(', ')}` });
    }

    const actual = await db.prepare('SELECT * FROM cirugias WHERE id = ?').get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Cirugia no encontrada' });

    let internacion = null;

    if (estado === 'finalizada') {
      if (!parte_quirurgico || !parte_quirurgico.trim()) {
        return res.status(400).json({
          error: 'Para finalizar hay que cargar el parte quirurgico: que se hizo, hallazgos y complicaciones.',
        });
      }

      const dias = DIAS_POR_COMPLEJIDAD[actual.complejidad] || 3;
      const altaEstimada = new Date();
      altaEstimada.setDate(altaEstimada.getDate() + dias);

      internacion = await db.transaccion(async (tx) => {
        await tx.prepare(`
          UPDATE cirugias SET estado = 'finalizada', parte_quirurgico = ?,
                 dias_internacion_estimados = ? WHERE id = ?
        `).run(parte_quirurgico, dias, req.params.id);

        // Ambulatoria va a recuperacion; el resto queda internado.
        const destino = actual.tipo_intervencion === 'ambulatoria' ? null : 'internacion';
        if (!destino) return null;

        const r = await internarPaciente(tx, {
          pacienteId: actual.paciente_id,
          destino,
          medicoACargoId: actual.cirujano_id,
          altaEstimada: altaEstimada.toISOString().slice(0, 10),
        });
        if (r.ok) {
          await tx.prepare('UPDATE cirugias SET cama_asignada_id = ? WHERE id = ?')
            .run(r.cama.id, req.params.id);
          await tx.prepare(`
            INSERT INTO derivaciones (id, paciente_id, origen, destino, motivo, derivado_por, prioridad)
            VALUES (?,?,?,?,?,?,?)
          `).run(nuevoId(), actual.paciente_id, 'quirofano', 'internacion',
                 `Post operatorio de ${actual.tipo_cirugia}`, req.sesion.nombreCompleto, 'normal');
        }
        return r;
      });
    } else {
      await db.prepare('UPDATE cirugias SET estado = ? WHERE id = ?').run(estado, req.params.id);
    }

    const paciente = await db.prepare('SELECT * FROM pacientes WHERE id = ?').get(actual.paciente_id);
    const nombre = `${paciente.apellido}, ${paciente.nombre}`;

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto, rol: req.sesion.rol, accion: 'modificacion',
      modulo: 'cirugia',
      descripcion: `Cirugia ${actual.tipo_cirugia} de ${nombre} marcada como ${estado}` +
        (internacion && internacion.ok ? `. Cama ${internacion.cama.codigo}.` : ''),
      pacienteId: actual.paciente_id,
    });

    if (estado === 'finalizada') {
      emitirNotificacion({
        destinoRol: 'enfermeria',
        tipo: 'post_operatorio',
        titulo: 'Paciente de post operatorio',
        mensaje: `${nombre} — ${actual.tipo_cirugia}` +
          (internacion && internacion.ok
            ? `. Cama ${internacion.cama.codigo}. Alta sugerida en ${DIAS_POR_COMPLEJIDAD[actual.complejidad] || 3} dias.`
            : internacion && !internacion.ok ? '. ATENCION: no hay camas libres en Internacion.' : ' (ambulatoria).'),
        pacienteId: actual.paciente_id,
      });
      if (actual.solicitado_por_medico_id) {
        emitirNotificacion({
          destinoRol: 'medico', destinoMedicoId: actual.solicitado_por_medico_id,
          tipo: 'cirugia_finalizada', titulo: 'Cirugia finalizada',
          mensaje: `${nombre} — ${actual.tipo_cirugia}. Parte quirurgico disponible.`,
          pacienteId: actual.paciente_id,
        });
      }
      emitirActualizacion({ salas: ['rol:enfermeria', 'rol:recepcion', 'rol:medico'], recurso: 'camas' });
      emitirActualizacion({ salas: ['rol:enfermeria', 'rol:medico'], recurso: 'internados' });
      emitirActualizacion({ salas: ['rol:enfermeria'], recurso: 'derivaciones' });
    }

    emitirActualizacion({ salas: ['rol:quirofano', 'rol:enfermeria', 'rol:medico'], recurso: 'cirugias' });

    res.json({
      ok: true,
      cama_asignada: internacion && internacion.ok ? internacion.cama.codigo : null,
      dias_estimados: estado === 'finalizada' ? (DIAS_POR_COMPLEJIDAD[actual.complejidad] || 3) : null,
      advertencia: internacion && !internacion.ok && internacion.motivo === 'sin_camas'
        ? 'No hay camas libres en Internacion. El paciente quedo sin cama asignada.'
        : null,
    });
  } catch (err) { next(err); }
});

// -------------------- ANESTESIOLOGIA --------------------
router.get('/fichas-anestesicas', async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT f.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
             c.tipo_cirugia, c.estado AS cirugia_estado, c.fecha_programada,
             a.apellido AS anestesiologo_apellido
      FROM fichas_anestesicas f
      JOIN pacientes p      ON p.id = f.paciente_id
      LEFT JOIN cirugias c  ON c.id = f.cirugia_id
      LEFT JOIN medicos  a  ON a.id = c.anestesiologo_id
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

router.post('/fichas-anestesicas', requireRol('quirofano'), async (req, res, next) => {
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

router.patch('/fichas-anestesicas/:id/drogas', requireRol('quirofano'), async (req, res, next) => {
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

router.patch('/fichas-anestesicas/:id/recuperacion', requireRol('quirofano'), async (req, res, next) => {
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

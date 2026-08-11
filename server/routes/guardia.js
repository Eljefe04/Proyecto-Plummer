const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId, parseJsonSafe } = require('./_utils');
const { internarPaciente, requiereCama, NOMBRE_SECTOR } = require('./_internacion');

const router = express.Router();
router.use(middlewareAuth);

router.get('/', async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT g.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni
      FROM guardia_ingresos g
      LEFT JOIN pacientes p ON p.id = g.paciente_id
      -- Solo quien esta fisicamente en el sector. Al derivarlo, el
      -- paciente pasa a la bandeja de Derivaciones recibidas del area
      -- de destino: siempre figura en un solo lugar a la vez.
      WHERE g.estado IN ('en_espera', 'en_atencion')
      ORDER BY g.nivel_triage ASC, g.creado_en DESC
    `).all();
    res.json(rows.map(hidratar));
  } catch (err) { next(err); }
});

router.post('/', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.protocolo_nn && !b.paciente_id) {
      return res.status(400).json({ error: 'Debe seleccionar un paciente o activar el Protocolo NN' });
    }
    if (!b.nivel_triage || !b.motivo_consulta) {
      return res.status(400).json({ error: 'Nivel de triage y motivo de consulta son obligatorios' });
    }

    // ------------------------------------------------------------
    // PROTOCOLO NN
    //
    // Antes el ingreso NN quedaba SOLO como fila en guardia_ingresos,
    // con paciente_id en null. Como camas.paciente_id referencia a
    // pacientes, no habia a quien asignarle una cama: el paciente
    // aparecia en guardia pero era imposible internarlo.
    //
    // Ahora se le crea una ficha real con identidad provisoria, que es
    // lo que hace un hospital de verdad: historia clinica temporal que
    // despues se completa al identificarlo.
    // ------------------------------------------------------------
    let pacienteId = b.paciente_id || null;

    if (b.protocolo_nn && !pacienteId) {
      pacienteId = nuevoId();
      const sufijo = pacienteId.replace(/-/g, '').slice(0, 6).toUpperCase();
      await db.prepare(`
        INSERT INTO pacientes (id, nombre, apellido, dni, estado, no_identificado, motivo_ingreso)
        VALUES (?, ?, ?, ?, 'ambulatorio', TRUE, ?)
      `).run(
        pacienteId,
        'NN',
        b.nombre_temporal || 'No identificado',
        `NN-${sufijo}`,
        b.motivo_consulta || 'Ingreso por Protocolo NN en Guardia',
      );
    }

    const id = nuevoId();
    await db.prepare(`
      INSERT INTO guardia_ingresos (
        id, paciente_id, protocolo_nn, nombre_temporal, medio_transporte,
        acompanante_nombre, acompanante_vinculo, nivel_triage, motivo_consulta,
        signos_vitales, observaciones, tags, cama_id, derivacion_destino
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, pacienteId, !!b.protocolo_nn, b.nombre_temporal || null,
      b.medio_transporte || 'particular', b.acompanante_nombre || null, b.acompanante_vinculo || null,
      b.nivel_triage, b.motivo_consulta, b.signos_vitales || null, b.observaciones || null,
      JSON.stringify(b.tags || []), b.cama_id || null, b.derivacion_destino || null
    );

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'guardia',
      descripcion: `Ingreso a guardia registrado (triage nivel ${b.nivel_triage})` +
        (b.protocolo_nn ? ' — Protocolo NN, ficha provisoria creada' : ''),
      pacienteId,
    });

    // Si el ingreso vino con cama elegida, se marca ocupada Y el paciente
    // pasa a internado. Antes solo se tocaba la cama, asi que el paciente
    // nunca aparecia en la pantalla de Internacion.
    if (b.cama_id) {
      await db.transaccion(async (tx) => {
        await tx.prepare(
          "UPDATE camas SET estado = 'ocupada', paciente_id = ?, limpieza_desde = NULL WHERE id = ?"
        ).run(pacienteId, b.cama_id);
        if (pacienteId) {
          await tx.prepare("UPDATE pacientes SET estado = 'internado' WHERE id = ?").run(pacienteId);
        }
      });
      emitirActualizacion({
        salas: ['rol:enfermeria', 'rol:recepcion', 'rol:medico'],
        recurso: 'camas',
      });
      emitirActualizacion({
        salas: ['rol:enfermeria', 'rol:recepcion', 'rol:medico'],
        recurso: 'internados',
      });
    }

    if (b.pre_orden_estudios && pacienteId) {
      const preOrdenId = nuevoId();
      await db.prepare(`
        INSERT INTO estudios_laboratorio (id, paciente_id, solicitado_por, estudios, prioridad, indicaciones)
        VALUES (?,?,?,?,?,?)
      `).run(
        preOrdenId, pacienteId, req.sesion.nombreCompleto,
        JSON.stringify(['Hemograma', 'Glucemia', 'Coagulograma']), 'urgente',
        'Pre-orden solicitada desde Guardia'
      );

      emitirNotificacion({
        destinoRol: 'laboratorio',
        tipo: 'preorden_guardia',
        titulo: 'Pre-orden urgente desde Guardia',
        mensaje: `Estudios solicitados para paciente en Guardia (triage ${b.nivel_triage})`,
        pacienteId,
      });
      emitirActualizacion({ salas: ['rol:laboratorio'], recurso: 'estudios_laboratorio' });
    }

    // Enfermeria es quien toma signos vitales: tiene que enterarse del
    // ingreso, y con sonido distinto si es un triage 1 o 2.
    const urgente = Number(b.nivel_triage) <= 2;
    emitirNotificacion({
      destinoRol: 'enfermeria',
      tipo: 'ingreso_guardia',
      titulo: urgente ? `Ingreso a Guardia — TRIAGE ${b.nivel_triage}` : 'Nuevo ingreso a Guardia',
      mensaje: `${b.motivo_consulta}${b.cama_id ? ' (con cama asignada)' : ''}`,
      pacienteId,
      prioridad: urgente ? 'urgente' : 'normal',
    });

    emitirActualizacion({ salas: ['rol:recepcion', 'rol:administrador', 'rol:enfermeria'], recurso: 'guardia' });

    const row = await db.prepare(`SELECT * FROM guardia_ingresos WHERE id = ?`).get(id);
    res.status(201).json(hidratar(row));
  } catch (err) { next(err); }
});

router.patch('/:id/derivar', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const { destino } = req.body;
    const actual = await db.prepare(`SELECT * FROM guardia_ingresos WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Ingreso no encontrado' });

    await db.prepare(`UPDATE guardia_ingresos SET derivacion_destino = ?, estado = 'derivado' WHERE id = ?`).run(destino, req.params.id);

    // La derivacion desde Guardia ahora interna de verdad: crea el
    // registro Y asigna cama en el sector de destino, marcando al
    // paciente como internado. Antes solo dejaba el registro y avisaba,
    // por eso el paciente nunca aparecia del otro lado.
    let internacion = null;
    if (actual.paciente_id) {
      const prioridad = Number(actual.nivel_triage) <= 2 ? 'urgente' : 'normal';
      internacion = await db.transaccion(async (tx) => {
        await tx.prepare(`
          INSERT INTO derivaciones (id, paciente_id, origen, destino, motivo, derivado_por, prioridad)
          VALUES (?,?,?,?,?,?,?)
        `).run(nuevoId(), actual.paciente_id, 'guardia', destino, actual.motivo_consulta,
               req.sesion.nombreCompleto, prioridad);

        if (!requiereCama(destino)) return null;
        return internarPaciente(tx, { pacienteId: actual.paciente_id, destino });
      });
    }

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'guardia',
      descripcion: `Paciente derivado de Guardia a ${destino}`,
      pacienteId: actual.paciente_id,
    });

    const urgente = Number(actual.nivel_triage) <= 2;
    let detalleCama = '';
    if (internacion && internacion.ok) {
      detalleCama = internacion.yaTenia
        ? ` Ya ocupaba la cama ${internacion.cama.codigo}.`
        : ` Cama asignada: ${internacion.cama.codigo}.`;
    } else if (internacion && internacion.motivo === 'sin_camas') {
      detalleCama = ` ATENCIÓN: no hay camas libres en ${NOMBRE_SECTOR[destino] || destino}.`;
    }

    emitirNotificacion({
      destinoRol: destino,
      tipo: 'derivacion_recibida',
      titulo: urgente ? 'Derivación URGENTE desde Guardia' : 'Nueva derivación desde Guardia',
      mensaje: `Paciente derivado desde Guardia (triage ${actual.nivel_triage}). ${actual.motivo_consulta}.${detalleCama}`,
      pacienteId: actual.paciente_id,
      prioridad: urgente ? 'urgente' : 'normal',
    });

    emitirActualizacion({ destinos: [destino], recurso: 'derivaciones' });
    emitirActualizacion({ salas: ['rol:recepcion', 'rol:enfermeria'], recurso: 'guardia' });
    if (internacion && internacion.ok) {
      emitirActualizacion({
        salas: ['rol:enfermeria', 'rol:recepcion', 'rol:medico'],
        recurso: 'camas',
      });
      emitirActualizacion({
        salas: ['rol:enfermeria', 'rol:recepcion', 'rol:medico'],
        recurso: 'internados',
      });
    }

    res.json({
      ok: true,
      cama_asignada: internacion && internacion.ok ? internacion.cama.codigo : null,
      advertencia: internacion && !internacion.ok && internacion.motivo === 'sin_camas'
        ? `No hay camas libres en ${NOMBRE_SECTOR[destino] || destino}.`
        : null,
    });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const actual = await db.prepare(`SELECT * FROM guardia_ingresos WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Ingreso no encontrado' });

    await db.prepare(`DELETE FROM guardia_ingresos WHERE id = ?`).run(req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'eliminacion',
      modulo: 'guardia',
      descripcion: `Ingreso a guardia eliminado (id ${req.params.id})`,
    });

    emitirActualizacion({ salas: ['rol:recepcion', 'rol:administrador'], recurso: 'guardia' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Completar la identidad de un paciente NN cuando se lo reconoce.
router.patch('/:id/identificar', requireRol('administrador', 'recepcion', 'enfermeria'),
  async (req, res, next) => {
    try {
      const { nombre, apellido, dni } = req.body;
      if (!nombre || !apellido || !dni) {
        return res.status(400).json({ error: 'Nombre, apellido y DNI son obligatorios' });
      }

      const ingreso = await db.prepare('SELECT * FROM guardia_ingresos WHERE id = ?').get(req.params.id);
      if (!ingreso) return res.status(404).json({ error: 'Ingreso no encontrado' });
      if (!ingreso.paciente_id) return res.status(409).json({ error: 'El ingreso no tiene ficha asociada' });

      const repetido = await db.prepare('SELECT id FROM pacientes WHERE dni = ? AND id <> ?')
        .get(dni, ingreso.paciente_id);
      if (repetido) return res.status(409).json({ error: `Ya existe un paciente con DNI ${dni}` });

      await db.prepare(`
        UPDATE pacientes
        SET nombre = ?, apellido = ?, dni = ?, no_identificado = FALSE
        WHERE id = ?
      `).run(nombre, apellido, dni, ingreso.paciente_id);

      await db.prepare("UPDATE guardia_ingresos SET protocolo_nn = FALSE WHERE id = ?").run(req.params.id);

      await registrarAuditoria({
        usuario: req.sesion.nombreCompleto,
        rol: req.sesion.rol,
        accion: 'modificacion',
        modulo: 'guardia',
        descripcion: `Paciente NN identificado como ${apellido}, ${nombre} (DNI ${dni})`,
        pacienteId: ingreso.paciente_id,
      });

      emitirActualizacion({
        salas: ['rol:recepcion', 'rol:enfermeria', 'rol:medico'],
        recurso: 'guardia',
      });
      emitirActualizacion({ salas: ['rol:enfermeria', 'rol:recepcion'], recurso: 'internados' });

      res.json({ ok: true });
    } catch (err) { next(err); }
  });

function hidratar(row) {
  return { ...row, tags: parseJsonSafe(row.tags, []) };
}

module.exports = router;

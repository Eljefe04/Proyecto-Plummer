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
    const rows = await db.prepare(`
      SELECT g.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni
      FROM guardia_ingresos g
      LEFT JOIN pacientes p ON p.id = g.paciente_id
      WHERE g.estado != 'alta'
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

    const id = nuevoId();
    await db.prepare(`
      INSERT INTO guardia_ingresos (
        id, paciente_id, protocolo_nn, nombre_temporal, medio_transporte,
        acompanante_nombre, acompanante_vinculo, nivel_triage, motivo_consulta,
        signos_vitales, observaciones, tags, cama_id, derivacion_destino
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, b.paciente_id || null, !!b.protocolo_nn, b.nombre_temporal || null,
      b.medio_transporte || 'particular', b.acompanante_nombre || null, b.acompanante_vinculo || null,
      b.nivel_triage, b.motivo_consulta, b.signos_vitales || null, b.observaciones || null,
      JSON.stringify(b.tags || []), b.cama_id || null, b.derivacion_destino || null
    );

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'guardia',
      descripcion: `Ingreso a guardia registrado (triage nivel ${b.nivel_triage})`,
      pacienteId: b.paciente_id || null,
    });

    if (b.cama_id) {
      await db.prepare(`UPDATE camas SET estado = 'ocupada', paciente_id = ? WHERE id = ?`).run(b.paciente_id || null, b.cama_id);
    }

    if (b.pre_orden_estudios && b.paciente_id) {
      const preOrdenId = nuevoId();
      await db.prepare(`
        INSERT INTO estudios_laboratorio (id, paciente_id, solicitado_por, estudios, prioridad, indicaciones)
        VALUES (?,?,?,?,?,?)
      `).run(
        preOrdenId, b.paciente_id, req.sesion.nombreCompleto,
        JSON.stringify(['Hemograma', 'Glucemia', 'Coagulograma']), 'urgente',
        'Pre-orden solicitada desde Guardia'
      );

      emitirNotificacion({
        destinoRol: 'laboratorio',
        tipo: 'preorden_guardia',
        titulo: 'Pre-orden urgente desde Guardia',
        mensaje: `Estudios solicitados para paciente en Guardia (triage ${b.nivel_triage})`,
        pacienteId: b.paciente_id,
      });
      emitirActualizacion({ salas: ['rol:laboratorio'], recurso: 'estudios_laboratorio' });
    }

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

    if (actual.paciente_id) {
      await db.prepare(`
        INSERT INTO derivaciones (id, paciente_id, origen, destino, motivo, derivado_por)
        VALUES (?,?,?,?,?,?)
      `).run(nuevoId(), actual.paciente_id, 'guardia', destino, actual.motivo_consulta, req.sesion.nombreCompleto);
    }

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'guardia',
      descripcion: `Paciente derivado de Guardia a ${destino}`,
      pacienteId: actual.paciente_id,
    });

    emitirNotificacion({
      destinoRol: destino,
      tipo: 'derivacion_recibida',
      titulo: 'Nueva derivación desde Guardia',
      mensaje: `Paciente derivado desde Guardia hacia ${destino}`,
      pacienteId: actual.paciente_id,
    });
    emitirActualizacion({ salas: [`rol:${destino}`, 'rol:recepcion'], recurso: 'guardia' });

    res.json({ ok: true });
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

function hidratar(row) {
  return { ...row, tags: parseJsonSafe(row.tags, []) };
}

module.exports = router;

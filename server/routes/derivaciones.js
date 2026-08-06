const express = require('express');
const db = require('../db/index');
const { middlewareAuth } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId } = require('./_utils');

const router = express.Router();
router.use(middlewareAuth);

router.get('/', async (req, res, next) => {
  try {
    const { paciente_id } = req.query;
    const rows = paciente_id
      ? await db.prepare(`SELECT * FROM derivaciones WHERE paciente_id = ? ORDER BY creado_en DESC`).all(paciente_id)
      : await db.prepare(`SELECT * FROM derivaciones ORDER BY creado_en DESC`).all();
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id || !b.origen || !b.destino) {
      return res.status(400).json({ error: 'Paciente, origen y destino son obligatorios' });
    }

    const id = nuevoId();
    await db.prepare(`
      INSERT INTO derivaciones (id, paciente_id, origen, destino, motivo, derivado_por)
      VALUES (?,?,?,?,?,?)
    `).run(id, b.paciente_id, b.origen, b.destino, b.motivo || null, req.sesion.nombreCompleto);

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(b.paciente_id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'derivaciones',
      descripcion: `Derivacion de ${paciente.nombre} ${paciente.apellido}: ${b.origen} -> ${b.destino}`,
      pacienteId: paciente.id,
    });

    emitirNotificacion({
      destinoRol: b.destino,
      tipo: 'derivacion_recibida',
      titulo: 'Nueva derivación recibida',
      mensaje: `${paciente.nombre} ${paciente.apellido} derivado desde ${b.origen}. Motivo: ${b.motivo || 'no especificado'}`,
      pacienteId: paciente.id,
    });
    emitirActualizacion({ salas: [`rol:${b.destino}`], recurso: 'derivaciones' });

    const row = await db.prepare(`SELECT * FROM derivaciones WHERE id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

module.exports = router;

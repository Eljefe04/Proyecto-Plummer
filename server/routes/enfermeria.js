const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId } = require('./_utils');

const router = express.Router();
router.use(middlewareAuth);

router.get('/pacientes-internados', async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT p.*, c.codigo AS cama_codigo, c.sector AS cama_sector
      FROM pacientes p
      JOIN camas c ON c.paciente_id = p.id
      WHERE p.estado = 'internado'
      ORDER BY c.sector, c.codigo
    `).all();
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/registros/:pacienteId', async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT * FROM enfermeria_registros WHERE paciente_id = ? ORDER BY creado_en DESC
    `).all(req.params.pacienteId);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/registros', requireRol('enfermeria', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id || !b.tipo || !b.detalle) {
      return res.status(400).json({ error: 'Paciente, tipo y detalle son obligatorios' });
    }
    const id = nuevoId();
    await db.prepare(`
      INSERT INTO enfermeria_registros (id, paciente_id, tipo, detalle, registrado_por)
      VALUES (?,?,?,?,?)
    `).run(id, b.paciente_id, b.tipo, typeof b.detalle === 'string' ? b.detalle : JSON.stringify(b.detalle), req.sesion.nombreCompleto);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'enfermeria',
      descripcion: `Registro de enfermeria (${b.tipo})`,
      pacienteId: b.paciente_id,
    });

    emitirActualizacion({ salas: ['rol:enfermeria'], recurso: 'enfermeria_registros' });

    const row = await db.prepare(`SELECT * FROM enfermeria_registros WHERE id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

module.exports = router;

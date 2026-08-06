const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirActualizacion } = require('../sockets/notificaciones');

const router = express.Router();
router.use(middlewareAuth);

router.get('/', async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT c.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
      FROM camas c
      LEFT JOIN pacientes p ON p.id = c.paciente_id
      ORDER BY c.sector, c.codigo
    `).all();
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/:id/asignar', requireRol('administrador', 'recepcion', 'enfermeria'), async (req, res, next) => {
  try {
    const { paciente_id } = req.body;
    const actual = await db.prepare(`SELECT * FROM camas WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Cama no encontrada' });

    await db.prepare(`UPDATE camas SET estado = 'ocupada', paciente_id = ? WHERE id = ?`).run(paciente_id, req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'camas',
      descripcion: `Cama ${actual.codigo} asignada`,
      pacienteId: paciente_id,
    });

    emitirActualizacion({ salas: ['rol:enfermeria', 'rol:recepcion', 'rol:administrador'], recurso: 'camas' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/:id/liberar', requireRol('administrador', 'recepcion', 'enfermeria'), async (req, res, next) => {
  try {
    const actual = await db.prepare(`SELECT * FROM camas WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Cama no encontrada' });

    await db.prepare(`UPDATE camas SET estado = 'limpieza', paciente_id = NULL WHERE id = ?`).run(req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'camas',
      descripcion: `Cama ${actual.codigo} liberada (en limpieza)`,
    });

    emitirActualizacion({ salas: ['rol:enfermeria', 'rol:recepcion', 'rol:administrador'], recurso: 'camas' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/:id/marcar-libre', requireRol('administrador', 'recepcion', 'enfermeria'), async (req, res, next) => {
  try {
    await db.prepare(`UPDATE camas SET estado = 'libre', paciente_id = NULL WHERE id = ?`).run(req.params.id);
    emitirActualizacion({ salas: ['rol:enfermeria', 'rol:recepcion', 'rol:administrador'], recurso: 'camas' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;

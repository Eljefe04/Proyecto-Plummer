const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId } = require('./_utils');

const router = express.Router();
router.use(middlewareAuth);

router.get('/medicamentos', async (req, res, next) => {
  try {
    const rows = await db.prepare(`SELECT * FROM medicamentos ORDER BY nombre`).all();
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/medicamentos', requireRol('farmacia', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nombre || !b.vencimiento) {
      return res.status(400).json({ error: 'Nombre y vencimiento son obligatorios' });
    }
    const id = nuevoId();
    await db.prepare(`
      INSERT INTO medicamentos (id, nombre, categoria, vencimiento, stock, stock_minimo)
      VALUES (?,?,?,?,?,?)
    `).run(id, b.nombre, b.categoria || 'Otros', b.vencimiento, b.stock || 0, b.stock_minimo || 20);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'farmacia',
      descripcion: `Alta de medicamento ${b.nombre} (stock inicial: ${b.stock || 0})`,
    });

    emitirActualizacion({ salas: ['rol:farmacia', 'rol:administrador'], recurso: 'medicamentos' });

    const row = await db.prepare(`SELECT * FROM medicamentos WHERE id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put('/medicamentos/:id', requireRol('farmacia', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    const actual = await db.prepare(`SELECT * FROM medicamentos WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Medicamento no encontrado' });

    await db.prepare(`
      UPDATE medicamentos SET nombre=?, categoria=?, vencimiento=?, stock=?, stock_minimo=? WHERE id=?
    `).run(
      b.nombre ?? actual.nombre, b.categoria ?? actual.categoria, b.vencimiento ?? actual.vencimiento,
      b.stock ?? actual.stock, b.stock_minimo ?? actual.stock_minimo, req.params.id
    );

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'farmacia',
      descripcion: `Actualizacion de stock de ${actual.nombre}`,
    });

    emitirActualizacion({ salas: ['rol:farmacia', 'rol:administrador'], recurso: 'medicamentos' });

    const row = await db.prepare(`SELECT * FROM medicamentos WHERE id = ?`).get(req.params.id);
    res.json(row);
  } catch (err) { next(err); }
});

router.delete('/medicamentos/:id', requireRol('farmacia', 'administrador'), async (req, res, next) => {
  try {
    const actual = await db.prepare(`SELECT * FROM medicamentos WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Medicamento no encontrado' });

    await db.prepare(`DELETE FROM medicamentos WHERE id = ?`).run(req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'eliminacion',
      modulo: 'farmacia',
      descripcion: `Eliminacion definitiva de medicamento ${actual.nombre} (lote vencido)`,
    });

    emitirActualizacion({ salas: ['rol:farmacia', 'rol:administrador'], recurso: 'medicamentos' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/dispensaciones', requireRol('farmacia', 'administrador'), async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT d.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, m.nombre AS medicamento_nombre
      FROM dispensaciones d
      JOIN pacientes p ON p.id = d.paciente_id
      JOIN medicamentos m ON m.id = d.medicamento_id
      ORDER BY d.creado_en DESC
      LIMIT 50
    `).all();
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/dispensar', requireRol('farmacia', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id || !b.medicamento_id || !b.cantidad) {
      return res.status(400).json({ error: 'Paciente, medicamento y cantidad son obligatorios' });
    }

    const medicamento = await db.prepare(`SELECT * FROM medicamentos WHERE id = ?`).get(b.medicamento_id);
    if (!medicamento) return res.status(404).json({ error: 'Medicamento no encontrado' });
    if (medicamento.stock < b.cantidad) {
      return res.status(400).json({ error: 'Stock insuficiente para dispensar esa cantidad' });
    }

    const id = nuevoId();
    await db.prepare(`
      INSERT INTO dispensaciones (id, paciente_id, medicamento_id, receta_id, cantidad, indicaciones, dispensado_por)
      VALUES (?,?,?,?,?,?,?)
    `).run(id, b.paciente_id, b.medicamento_id, b.receta_id || null, b.cantidad, b.indicaciones || null, req.sesion.nombreCompleto);

    await db.prepare(`UPDATE medicamentos SET stock = stock - ? WHERE id = ?`).run(b.cantidad, b.medicamento_id);

    if (b.receta_id) {
      await db.prepare(`UPDATE recetas SET estado = 'dispensada' WHERE id = ?`).run(b.receta_id);
    }

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(b.paciente_id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'farmacia',
      descripcion: `Dispensacion de ${medicamento.nombre} x${b.cantidad} a ${paciente.nombre} ${paciente.apellido}`,
      pacienteId: paciente.id,
    });

    emitirActualizacion({ salas: ['rol:farmacia', 'rol:administrador'], recurso: 'medicamentos' });

    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;

const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
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
    if (!b.medicamento_id || !b.cantidad) {
      return res.status(400).json({ error: 'Medicamento y cantidad son obligatorios' });
    }

    // ------------------------------------------------------------
    // DISPENSACION ATADA A LA RECETA
    //
    // Si viene una receta, el paciente NO se toma del cuerpo del pedido:
    // se toma de la receta. Asi es imposible dispensar a un tercero,
    // ni siquiera manipulando la llamada por fuera de la pantalla.
    // ------------------------------------------------------------
    let pacienteId = b.paciente_id;
    let receta = null;

    if (b.receta_id) {
      receta = await db.prepare('SELECT * FROM recetas WHERE id = ?').get(b.receta_id);
      if (!receta) return res.status(404).json({ error: 'La receta no existe' });

      if (receta.estado === 'dispensada') {
        return res.status(409).json({ error: 'Esta receta ya fue dispensada' });
      }
      if (b.paciente_id && b.paciente_id !== receta.paciente_id) {
        return res.status(409).json({
          error: 'El paciente no coincide con el de la receta. La medicación solo puede entregarse al paciente indicado.',
        });
      }
      pacienteId = receta.paciente_id;
    }

    if (!pacienteId) return res.status(400).json({ error: 'Falta indicar el paciente' });

    const medicamento = await db.prepare(`SELECT * FROM medicamentos WHERE id = ?`).get(b.medicamento_id);
    if (!medicamento) return res.status(404).json({ error: 'Medicamento no encontrado' });
    if (medicamento.stock < b.cantidad) {
      return res.status(400).json({
        error: `Stock insuficiente: quedan ${medicamento.stock} unidades de ${medicamento.nombre}`,
      });
    }

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(pacienteId);
    if (!paciente) return res.status(404).json({ error: 'El paciente no existe' });

    const id = nuevoId();
    await db.transaccion(async (tx) => {
      await tx.prepare(`
        INSERT INTO dispensaciones (id, paciente_id, medicamento_id, receta_id, cantidad, indicaciones, dispensado_por)
        VALUES (?,?,?,?,?,?,?)
      `).run(id, pacienteId, b.medicamento_id, b.receta_id || null, b.cantidad,
             b.indicaciones || null, req.sesion.nombreCompleto);

      await tx.prepare(`UPDATE medicamentos SET stock = stock - ? WHERE id = ?`)
        .run(b.cantidad, b.medicamento_id);

      if (b.receta_id) {
        await tx.prepare(`UPDATE recetas SET estado = 'dispensada' WHERE id = ?`).run(b.receta_id);
      }
    });

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'farmacia',
      descripcion: `Dispensacion de ${medicamento.nombre} x${b.cantidad} a ${paciente.nombre} ${paciente.apellido}`,
      pacienteId: paciente.id,
    });

    emitirActualizacion({ salas: ['rol:farmacia', 'rol:administrador'], recurso: 'medicamentos' });
    emitirActualizacion({ salas: ['rol:farmacia', 'rol:medico', 'rol:enfermeria'], recurso: 'recetas' });

    // El medico que firmo se entera de que su receta ya se entrego.
    if (receta && receta.medico_id) {
      emitirNotificacion({
        destinoRol: 'medico',
        destinoMedicoId: receta.medico_id,
        tipo: 'receta_dispensada',
        titulo: 'Receta dispensada',
        mensaje: `${medicamento.nombre} x${b.cantidad} entregado a ${paciente.apellido}, ${paciente.nombre}`,
        pacienteId,
      });
    }

    // Enfermeria administra lo que Farmacia entrega a un internado.
    if (paciente.estado === 'internado') {
      emitirNotificacion({
        destinoRol: 'enfermeria',
        tipo: 'medicacion_disponible',
        titulo: 'Medicación lista para administrar',
        mensaje: `${medicamento.nombre} x${b.cantidad} para ${paciente.apellido}, ${paciente.nombre}`,
        pacienteId,
      });
    }

    res.status(201).json({ ok: true, stock_restante: medicamento.stock - b.cantidad });
  } catch (err) { next(err); }
});

module.exports = router;

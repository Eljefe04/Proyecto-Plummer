const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { nuevoId, parseJsonSafe } = require('./_utils');

const router = express.Router();

router.use(middlewareAuth);

router.get('/', async (req, res, next) => {
  try {
    const { especialidad } = req.query;
    let rows;
    if (especialidad) {
      rows = await db.prepare(`SELECT * FROM medicos WHERE especialidad = ? ORDER BY apellido`).all(especialidad);
    } else {
      rows = await db.prepare(`SELECT * FROM medicos ORDER BY especialidad, apellido`).all();
    }
    res.json(rows.map(hidratar));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await db.prepare(`SELECT * FROM medicos WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Medico no encontrado' });
    res.json(hidratar(row));
  } catch (err) { next(err); }
});

router.post('/', requireRol('administrador', 'recepcion', 'quirofano'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.nombre || !b.apellido || !b.matricula || !b.especialidad) {
      return res.status(400).json({ error: 'Nombre, apellido, matricula y especialidad son obligatorios' });
    }

    const id = nuevoId();
    await db.prepare(`
      INSERT INTO medicos (
        id, nombre, apellido, dni, matricula, especialidad, consultorio,
        telefono, email, hora_inicio, hora_fin, duracion_turno_min, dias_atencion
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, b.nombre, b.apellido, b.dni || null, b.matricula, b.especialidad,
      b.consultorio || null, b.telefono || null, b.email || null,
      b.hora_inicio || null, b.hora_fin || null, b.duracion_turno_min || 30,
      JSON.stringify(b.dias_atencion || [])
    );

    const credencial = `${b.nombre} ${b.apellido}`.trim();
    await db.prepare(`
      INSERT INTO usuarios (id, usuario, password, rol, nombre_completo, medico_id)
      VALUES (?, ?, ?, 'medico', ?, ?)
    `).run(nuevoId(), credencial, credencial, credencial, id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'medicos',
      descripcion: `Alta de medico ${b.nombre} ${b.apellido} (${b.especialidad}) - acceso a terminal habilitado`,
    });

    const row = await db.prepare(`SELECT * FROM medicos WHERE id = ?`).get(id);
    res.status(201).json(hidratar(row));
  } catch (err) { next(err); }
});

router.put('/:id', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const b = req.body;
    const actual = await db.prepare(`SELECT * FROM medicos WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Medico no encontrado' });

    await db.prepare(`
      UPDATE medicos SET
        nombre=?, apellido=?, dni=?, matricula=?, especialidad=?, consultorio=?,
        telefono=?, email=?, hora_inicio=?, hora_fin=?, duracion_turno_min=?, dias_atencion=?
      WHERE id = ?
    `).run(
      b.nombre ?? actual.nombre, b.apellido ?? actual.apellido, b.dni ?? actual.dni,
      b.matricula ?? actual.matricula, b.especialidad ?? actual.especialidad, b.consultorio ?? actual.consultorio,
      b.telefono ?? actual.telefono, b.email ?? actual.email,
      b.hora_inicio ?? actual.hora_inicio, b.hora_fin ?? actual.hora_fin,
      b.duracion_turno_min ?? actual.duracion_turno_min,
      JSON.stringify(b.dias_atencion ?? parseJsonSafe(actual.dias_atencion, [])),
      req.params.id
    );

    if (b.nombre || b.apellido) {
      const nuevoNombre = b.nombre ?? actual.nombre;
      const nuevoApellido = b.apellido ?? actual.apellido;
      const credencial = `${nuevoNombre} ${nuevoApellido}`.trim();
      await db.prepare(`
        UPDATE usuarios SET usuario = ?, password = ?, nombre_completo = ?
        WHERE medico_id = ? AND rol = 'medico'
      `).run(credencial, credencial, credencial, req.params.id);
    }

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'medicos',
      descripcion: `Modificacion de datos del Dr./Dra. ${actual.nombre} ${actual.apellido}`,
    });

    const row = await db.prepare(`SELECT * FROM medicos WHERE id = ?`).get(req.params.id);
    res.json(hidratar(row));
  } catch (err) { next(err); }
});

router.patch('/:id/baja', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const actual = await db.prepare(`SELECT * FROM medicos WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Medico no encontrado' });

    const nuevoEstado = actual.estado === 'activo' ? 'inactivo' : 'activo';
    await db.prepare(`UPDATE medicos SET estado = ? WHERE id = ?`).run(nuevoEstado, req.params.id);
    await db.prepare(`UPDATE usuarios SET activo = ? WHERE medico_id = ?`).run(nuevoEstado === 'activo', req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'medicos',
      descripcion: `${nuevoEstado === 'activo' ? 'Reactivacion' : 'Baja'} de Dr./Dra. ${actual.nombre} ${actual.apellido}`,
    });

    res.json({ ok: true, estado: nuevoEstado });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRol('administrador'), async (req, res, next) => {
  try {
    const actual = await db.prepare(`SELECT * FROM medicos WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Medico no encontrado' });

    await db.prepare(`DELETE FROM medicos WHERE id = ?`).run(req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'eliminacion',
      modulo: 'medicos',
      descripcion: `Eliminacion definitiva de Dr./Dra. ${actual.nombre} ${actual.apellido}`,
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

function hidratar(row) {
  return { ...row, dias_atencion: parseJsonSafe(row.dias_atencion, []) };
}

module.exports = router;

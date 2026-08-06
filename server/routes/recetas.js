const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId } = require('./_utils');

const router = express.Router();
router.use(middlewareAuth);

router.get('/', async (req, res, next) => {
  try {
    const { paciente_id, medico_id } = req.query;
    let rows;
    if (paciente_id) {
      rows = await db.prepare(`SELECT * FROM recetas WHERE paciente_id = ? ORDER BY creado_en DESC`).all(paciente_id);
    } else if (medico_id) {
      rows = await db.prepare(`SELECT r.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
        FROM recetas r JOIN pacientes p ON p.id = r.paciente_id
        WHERE r.medico_id = ? ORDER BY r.creado_en DESC`).all(medico_id);
    } else {
      rows = await db.prepare(`SELECT * FROM recetas ORDER BY creado_en DESC`).all();
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', requireRol('medico', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id || !b.medicamento) {
      return res.status(400).json({ error: 'Paciente y medicamento son obligatorios' });
    }
    const medicoId = b.medico_id || req.sesion.medicoId;
    const id = nuevoId();

    await db.prepare(`
      INSERT INTO recetas (id, paciente_id, medico_id, medicamento, dosis, via_administracion, frecuencia, duracion_tratamiento, indicaciones)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(id, b.paciente_id, medicoId, b.medicamento, b.dosis || null, b.via_administracion || null,
      b.frecuencia || null, b.duracion_tratamiento || null, b.indicaciones || null);

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(b.paciente_id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'recetas',
      descripcion: `Receta digital emitida: ${b.medicamento} para ${paciente.nombre} ${paciente.apellido}`,
      pacienteId: paciente.id,
    });

    emitirNotificacion({
      destinoRol: 'farmacia',
      tipo: 'receta_nueva',
      titulo: 'Nueva receta digital',
      mensaje: `${paciente.nombre} ${paciente.apellido} - ${b.medicamento} (${b.dosis || 'sin dosis especificada'}) - ${b.indicaciones || ''}`,
      pacienteId: paciente.id,
    });
    emitirActualizacion({ salas: ['rol:farmacia'], recurso: 'recetas' });

    const row = await db.prepare(`SELECT * FROM recetas WHERE id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

module.exports = router;

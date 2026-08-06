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
    const { paciente_id, medico_id } = req.query;
    let rows;
    if (paciente_id) {
      rows = await db.prepare(`SELECT * FROM estudios_laboratorio WHERE paciente_id = ? ORDER BY creado_en DESC`).all(paciente_id);
    } else if (medico_id) {
      rows = await db.prepare(`
        SELECT e.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
        FROM estudios_laboratorio e JOIN pacientes p ON p.id = e.paciente_id
        WHERE e.solicitado_por_medico_id = ? ORDER BY e.creado_en DESC
      `).all(medico_id);
    } else {
      rows = await db.prepare(`
        SELECT e.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni
        FROM estudios_laboratorio e JOIN pacientes p ON p.id = e.paciente_id
        ORDER BY e.prioridad DESC, e.creado_en DESC
      `).all();
    }
    res.json(rows.map(hidratar));
  } catch (err) { next(err); }
});

router.post('/', requireRol('medico', 'recepcion', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id || !b.estudios || !b.estudios.length) {
      return res.status(400).json({ error: 'Paciente y al menos un estudio son obligatorios' });
    }
    const id = nuevoId();
    const medicoId = req.sesion.rol === 'medico' ? req.sesion.medicoId : (b.solicitado_por_medico_id || null);

    await db.prepare(`
      INSERT INTO estudios_laboratorio (id, paciente_id, solicitado_por, solicitado_por_medico_id, estudios, prioridad, indicaciones)
      VALUES (?,?,?,?,?,?,?)
    `).run(id, b.paciente_id, req.sesion.nombreCompleto, medicoId, JSON.stringify(b.estudios), b.prioridad || 'normal', b.indicaciones || null);

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(b.paciente_id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'laboratorio',
      descripcion: `Estudios solicitados para ${paciente.nombre} ${paciente.apellido}: ${b.estudios.join(', ')}`,
      pacienteId: paciente.id,
    });

    emitirNotificacion({
      destinoRol: 'laboratorio',
      tipo: 'estudio_solicitado',
      titulo: b.prioridad === 'urgente' ? 'Estudio URGENTE solicitado' : 'Nuevo estudio solicitado',
      mensaje: `${paciente.nombre} ${paciente.apellido} - ${b.estudios.join(', ')}`,
      pacienteId: paciente.id,
    });
    emitirActualizacion({ salas: ['rol:laboratorio'], recurso: 'estudios_laboratorio' });

    const row = await db.prepare(`SELECT * FROM estudios_laboratorio WHERE id = ?`).get(id);
    res.status(201).json(hidratar(row));
  } catch (err) { next(err); }
});

router.patch('/:id/resultado', requireRol('laboratorio', 'administrador'), async (req, res, next) => {
  try {
    const { resultado } = req.body;
    const actual = await db.prepare(`SELECT * FROM estudios_laboratorio WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Estudio no encontrado' });

    await db.prepare(`
      UPDATE estudios_laboratorio SET resultado = ?, estado = 'realizado', completado_en = NOW() WHERE id = ?
    `).run(resultado, req.params.id);

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(actual.paciente_id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'laboratorio',
      descripcion: `Resultado cargado para ${paciente.nombre} ${paciente.apellido}`,
      pacienteId: paciente.id,
    });

    if (actual.solicitado_por_medico_id) {
      emitirNotificacion({
        destinoRol: 'medico',
        destinoMedicoId: actual.solicitado_por_medico_id,
        tipo: 'resultado_listo',
        titulo: 'Resultado de laboratorio disponible',
        mensaje: `${paciente.nombre} ${paciente.apellido} - resultado ya cargado en la HCE`,
        pacienteId: paciente.id,
      });
      emitirActualizacion({ salas: [`medico:${actual.solicitado_por_medico_id}`], recurso: 'estudios_laboratorio' });
    }

    const row = await db.prepare(`SELECT * FROM estudios_laboratorio WHERE id = ?`).get(req.params.id);
    res.json(hidratar(row));
  } catch (err) { next(err); }
});

function hidratar(row) {
  return { ...row, estudios: parseJsonSafe(row.estudios, []) };
}

module.exports = router;

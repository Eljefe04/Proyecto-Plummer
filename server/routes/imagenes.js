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
      rows = await db.prepare(`SELECT * FROM estudios_imagenes WHERE paciente_id = ? ORDER BY creado_en DESC`).all(paciente_id);
    } else if (medico_id) {
      rows = await db.prepare(`
        SELECT e.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni
        FROM estudios_imagenes e JOIN pacientes p ON p.id = e.paciente_id
        WHERE e.solicitado_por_medico_id = ? ORDER BY e.creado_en DESC
      `).all(medico_id);
    } else {
      rows = await db.prepare(`
        SELECT e.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni
        FROM estudios_imagenes e JOIN pacientes p ON p.id = e.paciente_id
        ORDER BY e.prioridad DESC, e.creado_en DESC
      `).all();
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', requireRol('medico', 'recepcion', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id || !b.tipo_estudio) {
      return res.status(400).json({ error: 'Paciente y tipo de estudio son obligatorios' });
    }
    const id = nuevoId();
    const medicoId = req.sesion.rol === 'medico' ? req.sesion.medicoId : (b.solicitado_por_medico_id || null);

    await db.prepare(`
      INSERT INTO estudios_imagenes (id, paciente_id, solicitado_por, solicitado_por_medico_id, tipo_estudio, region, prioridad)
      VALUES (?,?,?,?,?,?,?)
    `).run(id, b.paciente_id, req.sesion.nombreCompleto, medicoId, b.tipo_estudio, b.region || null, b.prioridad || 'normal');

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(b.paciente_id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'imagenes',
      descripcion: `Estudio de imagen solicitado para ${paciente.nombre} ${paciente.apellido}: ${b.tipo_estudio}`,
      pacienteId: paciente.id,
    });

    emitirNotificacion({
      destinoRol: 'imagenes',
      tipo: 'estudio_solicitado',
      titulo: b.prioridad === 'urgente' ? 'Estudio de imagen URGENTE' : 'Nuevo estudio de imagen',
      mensaje: `${paciente.nombre} ${paciente.apellido} - ${b.tipo_estudio}`,
      pacienteId: paciente.id,
    });
    emitirActualizacion({ salas: ['rol:imagenes'], recurso: 'estudios_imagenes' });

    const row = await db.prepare(`SELECT * FROM estudios_imagenes WHERE id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.patch('/:id/informe', requireRol('imagenes', 'administrador'), async (req, res, next) => {
  try {
    const { informe } = req.body;
    const actual = await db.prepare(`SELECT * FROM estudios_imagenes WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Estudio no encontrado' });

    await db.prepare(`
      UPDATE estudios_imagenes SET informe = ?, estado = 'realizado', completado_en = NOW() WHERE id = ?
    `).run(informe, req.params.id);

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(actual.paciente_id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'imagenes',
      descripcion: `Informe cargado para ${paciente.nombre} ${paciente.apellido}`,
      pacienteId: paciente.id,
    });

    if (actual.solicitado_por_medico_id) {
      emitirNotificacion({
        destinoRol: 'medico',
        destinoMedicoId: actual.solicitado_por_medico_id,
        tipo: 'informe_listo',
        titulo: 'Informe de imagen disponible',
        mensaje: `${paciente.nombre} ${paciente.apellido} - informe ya cargado en la HCE`,
        pacienteId: paciente.id,
      });
      emitirActualizacion({ salas: [`medico:${actual.solicitado_por_medico_id}`], recurso: 'estudios_imagenes' });
    }

    const row = await db.prepare(`SELECT * FROM estudios_imagenes WHERE id = ?`).get(req.params.id);
    res.json(row);
  } catch (err) { next(err); }
});

module.exports = router;

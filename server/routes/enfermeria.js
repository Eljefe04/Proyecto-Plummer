const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId } = require('./_utils');

const router = express.Router();
router.use(middlewareAuth);

router.get('/pacientes-internados', async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT p.*,
             c.codigo AS cama_codigo,
             c.sector AS cama_sector,
             m.nombre  AS medico_nombre,
             m.apellido AS medico_apellido,
             CASE WHEN p.alta_estimada IS NOT NULL
                  THEN (p.alta_estimada - CURRENT_DATE) END AS dias_para_alta
      FROM pacientes p
      -- LEFT JOIN a proposito: si por algun motivo un paciente quedara
      -- marcado como internado sin cama, tiene que aparecer igual en la
      -- lista para poder resolverlo, no volverse invisible.
      LEFT JOIN camas c   ON c.paciente_id = p.id
      LEFT JOIN medicos m ON m.id = p.medico_a_cargo_id
      WHERE p.estado = 'internado'
      ORDER BY c.sector NULLS FIRST, c.codigo
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

// ------------------------------------------------------------
// POST /api/enfermeria/alta
//
// Da de alta a un paciente internado: vuelve a ambulatorio, libera su
// cama (que entra en limpieza) y queda asentado en la historia clinica
// y en auditoria. Antes no existia ninguna forma de sacar a un paciente
// de Internacion.
// ------------------------------------------------------------
router.post('/alta', requireRol('enfermeria', 'medico', 'administrador'), async (req, res, next) => {
  try {
    const { paciente_id, observaciones = null } = req.body;
    if (!paciente_id) return res.status(400).json({ error: 'Falta el paciente' });

    const resultado = await db.transaccion(async (tx) => {
      const paciente = await tx.prepare('SELECT * FROM pacientes WHERE id = ?').get(paciente_id);
      if (!paciente) return { error: 'El paciente no existe', status: 404 };
      if (paciente.estado !== 'internado') {
        return { error: 'El paciente no figura internado', status: 409 };
      }

      const cama = await tx.prepare('SELECT * FROM camas WHERE paciente_id = ?').get(paciente_id);

      await tx.prepare(
        "UPDATE pacientes SET estado = 'ambulatorio', alta_estimada = NULL WHERE id = ?"
      ).run(paciente_id);

      if (cama) {
        await tx.prepare(
          "UPDATE camas SET estado = 'limpieza', paciente_id = NULL, limpieza_desde = NOW() WHERE id = ?"
        ).run(cama.id);
      }

      // Nota automatica en la hoja de enfermeria, para que el alta quede
      // en la historia clinica y no solo en la auditoria.
      await tx.prepare(`
        INSERT INTO enfermeria_registros (id, paciente_id, tipo, detalle, registrado_por)
        VALUES (?, ?, 'nota_evolucion', ?, ?)
      `).run(
        uuidv4(),
        paciente_id,
        `Alta de internacion${cama ? ` desde la cama ${cama.codigo}` : ''}.` +
          (observaciones ? ` ${observaciones}` : ''),
        req.sesion.nombreCompleto,
      );

      return { paciente, cama };
    });

    if (resultado.error) return res.status(resultado.status).json({ error: resultado.error });

    const { paciente, cama } = resultado;
    const nombre = `${paciente.apellido}, ${paciente.nombre}`;

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'enfermeria',
      descripcion: `Dio de alta a ${nombre}${cama ? ` y libero la cama ${cama.codigo}` : ''}`,
      pacienteId: paciente_id,
    });

    emitirNotificacion({
      destinoRol: 'recepcion',
      tipo: 'alta_paciente',
      titulo: 'Alta de internacion',
      mensaje: `${nombre} fue dado de alta${cama ? `. Cama ${cama.codigo} en limpieza.` : ''}`,
      pacienteId: paciente_id,
    });

    emitirActualizacion({
      salas: ['rol:enfermeria', 'rol:recepcion', 'rol:medico', 'rol:quirofano'],
      recurso: 'internados',
    });
    emitirActualizacion({
      salas: ['rol:enfermeria', 'rol:recepcion', 'rol:medico', 'rol:quirofano'],
      recurso: 'camas',
    });

    res.json({ ok: true, cama_liberada: cama ? cama.codigo : null });
  } catch (err) { next(err); }
});

module.exports = router;

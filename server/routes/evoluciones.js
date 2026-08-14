// ------------------------------------------------------------
// EVOLUCIONES CLINICAS
//
// La tabla `evoluciones` existia en el esquema desde el principio y
// NINGUNA ruta la usaba: cero endpoints, cero pantallas. Es decir, un
// medico atendia a un paciente y no podia escribir que paso en la
// consulta. La historia clinica unificada —el homenaje al Dr. Plummer
// y el nombre del proyecto— no tenia evoluciones.
//
// Esto lo arregla: cada consulta deja constancia, firmada por el medico
// que la escribio, y todo el equipo la ve en la misma linea de tiempo.
// ------------------------------------------------------------

const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId } = require('./_utils');

const router = express.Router();
router.use(middlewareAuth);

const SELECT_EVOLUCIONES = `
  SELECT e.*,
         m.nombre       AS medico_nombre,
         m.apellido     AS medico_apellido,
         m.especialidad AS medico_especialidad,
         m.matricula    AS medico_matricula,
         p.nombre       AS paciente_nombre,
         p.apellido     AS paciente_apellido
  FROM evoluciones e
  JOIN medicos m   ON m.id = e.medico_id
  JOIN pacientes p ON p.id = e.paciente_id
`;

// GET /api/evoluciones?paciente_id=...  o  ?medico_id=...
router.get('/', async (req, res, next) => {
  try {
    const { paciente_id, medico_id } = req.query;

    // La condicion se arma segun lo que llegue, en vez de usar el patron
    // "? IS NULL OR columna = ?": ahi PostgreSQL no puede inferir el tipo
    // del parametro cuando viene null y la consulta falla entera.
    const condiciones = [];
    const params = [];
    if (paciente_id) { condiciones.push('e.paciente_id = ?'); params.push(paciente_id); }
    if (medico_id)   { condiciones.push('e.medico_id = ?');   params.push(medico_id); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const rows = await db.prepare(`
      ${SELECT_EVOLUCIONES}
      ${where}
      ORDER BY e.fecha_hora DESC
      LIMIT 200
    `).all(...params);
    res.json(rows);
  } catch (err) { next(err); }
});

/**
 * Historia clinica unificada de un paciente.
 *
 * Reune en una sola linea de tiempo TODO lo que le paso: evoluciones,
 * estudios de laboratorio, imagenes, recetas, derivaciones y cirugias.
 * Esto es exactamente lo que invento Plummer en 1907: un unico
 * expediente por paciente en vez de cuadernos sueltos por medico.
 */
router.get('/hce/:pacienteId', async (req, res, next) => {
  try {
    const id = req.params.pacienteId;

    const paciente = await db.prepare('SELECT * FROM pacientes WHERE id = ?').get(id);
    if (!paciente) return res.status(404).json({ error: 'El paciente no existe' });

    const [evoluciones, laboratorio, imagenes, recetas, derivaciones, cirugias] = await Promise.all([
      db.prepare(`${SELECT_EVOLUCIONES} WHERE e.paciente_id = ? ORDER BY e.fecha_hora DESC`).all(id),
      db.prepare(`
        SELECT id, estudios, estado, prioridad, resultado, creado_en, completado_en
        FROM estudios_laboratorio WHERE paciente_id = ? ORDER BY creado_en DESC
      `).all(id),
      db.prepare(`
        SELECT id, tipo_estudio, region, estado, informe, creado_en, completado_en,
               (imagen_datos IS NOT NULL) AS tiene_imagen
        FROM estudios_imagenes WHERE paciente_id = ? ORDER BY creado_en DESC
      `).all(id),
      db.prepare(`
        SELECT r.id, r.medicamento, r.dosis, r.frecuencia, r.estado, r.creado_en,
               m.apellido AS medico_apellido
        FROM recetas r LEFT JOIN medicos m ON m.id = r.medico_id
        WHERE r.paciente_id = ? ORDER BY r.creado_en DESC
      `).all(id),
      db.prepare(`
        SELECT id, origen, destino, motivo, prioridad, estado, creado_en
        FROM derivaciones WHERE paciente_id = ? ORDER BY creado_en DESC
      `).all(id),
      db.prepare(`
        SELECT c.id, c.tipo_cirugia, c.estado, c.caracter, c.fecha_programada,
               c.parte_quirurgico, c.creado_en, m.apellido AS cirujano_apellido
        FROM cirugias c LEFT JOIN medicos m ON m.id = c.cirujano_id
        WHERE c.paciente_id = ? ORDER BY c.creado_en DESC
      `).all(id),
    ]);

    // Se registra el acceso a la historia clinica: trazabilidad real.
    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'acceso_hce',
      modulo: 'evoluciones',
      descripcion: `Consultó la historia clínica de ${paciente.apellido}, ${paciente.nombre}`,
      pacienteId: id,
    });

    res.json({
      paciente,
      evoluciones,
      laboratorio: laboratorio.map((e) => ({
        ...e,
        estudios: (() => { try { return JSON.parse(e.estudios); } catch { return [e.estudios]; } })(),
      })),
      imagenes,
      recetas,
      derivaciones,
      cirugias,
    });
  } catch (err) { next(err); }
});

// POST /api/evoluciones — escribir una evolución
router.post('/', requireRol('medico', 'quirofano'), async (req, res, next) => {
  try {
    const { paciente_id, texto } = req.body;
    if (!paciente_id || !texto || !texto.trim()) {
      return res.status(400).json({ error: 'Paciente y texto de la evolución son obligatorios' });
    }

    // Una evolución la firma un médico matriculado. Si la carga alguien
    // que no es médico, tiene que indicar cuál, igual que en las recetas.
    const medicoId = req.body.medico_id || req.sesion.medicoId;
    if (!medicoId) {
      return res.status(400).json({ error: 'Falta indicar el médico que firma la evolución.' });
    }

    const medico = await db.prepare('SELECT * FROM medicos WHERE id = ?').get(medicoId);
    if (!medico) return res.status(404).json({ error: 'El médico indicado no existe' });

    const paciente = await db.prepare('SELECT * FROM pacientes WHERE id = ?').get(paciente_id);
    if (!paciente) return res.status(404).json({ error: 'El paciente no existe' });

    const id = nuevoId();
    await db.prepare(`
      INSERT INTO evoluciones (id, paciente_id, medico_id, texto) VALUES (?,?,?,?)
    `).run(id, paciente_id, medicoId, texto.trim());

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'evoluciones',
      descripcion: `Evolución clínica de ${paciente.apellido}, ${paciente.nombre}`,
      pacienteId: paciente_id,
    });

    emitirActualizacion({
      salas: ['rol:medico', 'rol:enfermeria', `medico:${medicoId}`],
      recurso: 'evoluciones',
    });

    const row = await db.prepare(`${SELECT_EVOLUCIONES} WHERE e.id = ?`).get(id);
    res.status(201).json(row);
  } catch (err) { next(err); }
});

module.exports = router;

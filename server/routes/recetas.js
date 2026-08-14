const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId } = require('./_utils');

const router = express.Router();
router.use(middlewareAuth);

// Consulta unica con los datos que necesita cualquier pantalla:
// nombre del paciente, medico que firmo y stock del medicamento enlazado.
// Antes la consulta sin filtro era un SELECT * pelado, sin JOIN, asi que
// Farmacia no podia saber ni de que paciente era la receta.
const SELECT_RECETAS = `
  SELECT r.*,
         p.nombre   AS paciente_nombre,
         p.apellido AS paciente_apellido,
         p.dni      AS paciente_dni,
         p.alergias AS paciente_alergias,
         m.nombre   AS medico_nombre,
         m.apellido AS medico_apellido,
         m.especialidad AS medico_especialidad,
         med.nombre AS inventario_nombre,
         med.stock  AS inventario_stock,
         med.categoria AS inventario_categoria
  FROM recetas r
  LEFT JOIN pacientes p    ON p.id = r.paciente_id
  LEFT JOIN medicos m      ON m.id = r.medico_id
  LEFT JOIN medicamentos med ON med.id = r.medicamento_id
`;

router.get('/', async (req, res, next) => {
  try {
    const { paciente_id, medico_id, estado } = req.query;
    const rows = await db.prepare(`
      ${SELECT_RECETAS}
      WHERE (CAST(? AS TEXT) IS NULL OR r.paciente_id = ?)
        AND (CAST(? AS TEXT) IS NULL OR r.medico_id = ?)
        AND (CAST(? AS TEXT) IS NULL OR r.estado = ?)
      ORDER BY r.creado_en DESC
    `).all(
      paciente_id || null, paciente_id || null,
      medico_id || null, medico_id || null,
      estado || null, estado || null,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Bandeja de Farmacia: lo que falta dispensar, lo mas viejo primero.
router.get('/pendientes', async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      ${SELECT_RECETAS}
      WHERE r.estado = 'pendiente'
      ORDER BY r.creado_en ASC
    `).all();
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', requireRol('medico', 'quirofano'), async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id || !b.medicamento) {
      return res.status(400).json({ error: 'Paciente y medicamento son obligatorios' });
    }
    // Una receta la firma un medico matriculado. Si quien la carga no es
    // un medico (Quirofano o Administrador), tiene que indicar cual, para
    // que la receta no quede sin responsable.
    const medicoId = b.medico_id || req.sesion.medicoId;
    if (!medicoId) {
      return res.status(400).json({
        error: 'Falta indicar el médico que firma la receta. Seleccionalo de la lista.',
      });
    }
    const firmante = await db.prepare('SELECT * FROM medicos WHERE id = ?').get(medicoId);
    if (!firmante) return res.status(404).json({ error: 'El médico indicado no existe' });

    const id = nuevoId();

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(b.paciente_id);
    if (!paciente) return res.status(404).json({ error: 'El paciente no existe' });

    // Si el medico eligio del inventario de Farmacia, se guarda el enlace:
    // asi Farmacia ve el medicamento ya preseleccionado al dispensar.
    await db.prepare(`
      INSERT INTO recetas (id, paciente_id, medico_id, medicamento, medicamento_id, dosis, via_administracion, frecuencia, duracion_tratamiento, indicaciones)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(id, b.paciente_id, medicoId, b.medicamento, b.medicamento_id || null, b.dosis || null,
      b.via_administracion || null, b.frecuencia || null, b.duracion_tratamiento || null, b.indicaciones || null);

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

const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId } = require('./_utils');

// ------------------------------------------------------------
// CATALOGO POR MODALIDAD
// El medico elegia el estudio escribiendolo a mano, asi que Imagenes
// recibia "Radiografia" a secas sin saber de que parte del cuerpo.
// ------------------------------------------------------------
const MODALIDADES = {
  'Radiografía': ['Tórax', 'Abdomen', 'Columna cervical', 'Columna lumbar', 'Cadera', 'Rodilla', 'Hombro', 'Mano', 'Pie', 'Cráneo'],
  'Ecografía': ['Abdominal', 'Renal', 'Ginecológica', 'Obstétrica', 'Tiroidea', 'Partes blandas', 'Doppler de miembros'],
  'Tomografía (TAC)': ['Cerebro', 'Tórax', 'Abdomen y pelvis', 'Columna', 'Senos paranasales'],
  'Resonancia (RMN)': ['Cerebro', 'Columna cervical', 'Columna lumbar', 'Rodilla', 'Hombro'],
  'Mamografía': ['Bilateral', 'Unilateral derecha', 'Unilateral izquierda'],
};

// Plantillas de informe, para no escribir de cero cada vez.
const PLANTILLAS = {
  'Radiografía': 'Técnica: proyección frontal y lateral.\nHallazgos: \nConclusión: ',
  'Ecografía': 'Técnica: transductor convexo.\nHallazgos: \nConclusión: ',
  'Tomografía (TAC)': 'Técnica: cortes axiales sin contraste.\nHallazgos: \nConclusión: ',
  'Resonancia (RMN)': 'Técnica: secuencias T1, T2 y STIR.\nHallazgos: \nConclusión: ',
  'Mamografía': 'Técnica: proyecciones craneocaudal y oblicua.\nHallazgos: \nCategoría BI-RADS: \nConclusión: ',
};

const router = express.Router();
router.use(middlewareAuth);

router.get('/catalogo', (req, res) => {
  res.json({
    modalidades: Object.entries(MODALIDADES).map(([nombre, regiones]) => ({ nombre, regiones })),
    plantillas: PLANTILLAS,
  });
});

// Detalle completo, imagen incluida. Se pide solo al abrir un estudio:
// mandar los base64 en cada listado haria pesadisima la respuesta.
router.get('/:id/detalle', async (req, res, next) => {
  try {
    const row = await db.prepare(`
      SELECT e.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni
      FROM estudios_imagenes e JOIN pacientes p ON p.id = e.paciente_id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Estudio no encontrado' });
    res.json(row);
  } catch (err) { next(err); }
});

router.get('/metricas', async (req, res, next) => {
  try {
    const m = await db.prepare(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'pendiente')  AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'en_sala')    AS en_sala,
        COUNT(*) FILTER (WHERE estado = 'realizado')  AS sin_informar,
        COUNT(*) FILTER (WHERE estado = 'pendiente' AND prioridad = 'urgente') AS urgentes,
        COUNT(*) FILTER (WHERE estado IN ('informado','entregado')
                          AND completado_en::date = CURRENT_DATE) AS informados_hoy
      FROM estudios_imagenes
    `).get();
    res.json(m);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { paciente_id, medico_id } = req.query;
    let rows;
    if (paciente_id) {
      rows = await db.prepare(`SELECT * FROM estudios_imagenes WHERE paciente_id = ? ORDER BY creado_en DESC`).all(paciente_id);
    } else if (medico_id) {
      rows = await db.prepare(`
        SELECT e.id, e.paciente_id, e.solicitado_por, e.solicitado_por_medico_id,
               e.tipo_estudio, e.region, e.prioridad, e.informe, e.estado,
               e.indicaciones, e.origen_modulo, e.creado_en, e.completado_en,
               (e.imagen_datos IS NOT NULL) AS tiene_imagen,
               p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni
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
      INSERT INTO estudios_imagenes (id, paciente_id, solicitado_por, solicitado_por_medico_id, tipo_estudio, region, prioridad, indicaciones, origen_modulo)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(id, b.paciente_id, req.sesion.nombreCompleto, medicoId, b.tipo_estudio, b.region || null, b.prioridad || 'normal', b.indicaciones || null, b.origen_modulo || req.sesion.rol);

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

router.patch('/:id/estado', requireRol('imagenes'), async (req, res, next) => {
  try {
    const { estado } = req.body;
    const validos = ['pendiente', 'en_sala', 'realizado', 'informado', 'entregado'];
    if (!validos.includes(estado)) {
      return res.status(400).json({ error: `Estado no valido. Debe ser uno de: ${validos.join(', ')}` });
    }
    const actual = await db.prepare('SELECT * FROM estudios_imagenes WHERE id = ?').get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Estudio no encontrado' });

    await db.prepare('UPDATE estudios_imagenes SET estado = ? WHERE id = ?').run(estado, req.params.id);
    emitirActualizacion({ salas: ['rol:imagenes', 'rol:medico'], recurso: 'estudios_imagenes' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// La placa se guarda DENTRO de Postgres, no en disco: el disco de Render
// es efimero y se borra en cada reinicio. El navegador la comprime antes
// de subirla para que no ocupe de mas.
router.patch('/:id/imagen', requireRol('imagenes'), async (req, res, next) => {
  try {
    const { imagen_datos } = req.body;
    if (!imagen_datos) return res.status(400).json({ error: 'No se recibio ninguna imagen' });
    if (imagen_datos.length > 1400000) {
      return res.status(413).json({ error: 'La imagen es demasiado grande. Maximo aproximado: 1 MB.' });
    }
    const actual = await db.prepare('SELECT * FROM estudios_imagenes WHERE id = ?').get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Estudio no encontrado' });

    await db.prepare('UPDATE estudios_imagenes SET imagen_datos = ? WHERE id = ?')
      .run(imagen_datos, req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'imagenes',
      descripcion: `Imagen adjuntada al estudio ${actual.tipo_estudio}`,
      pacienteId: actual.paciente_id,
    });

    emitirActualizacion({ salas: ['rol:imagenes', 'rol:medico'], recurso: 'estudios_imagenes' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/:id/informe', requireRol('imagenes'), async (req, res, next) => {
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

    const estadoNuevo = 'informado';
    await db.prepare("UPDATE estudios_imagenes SET estado = ? WHERE id = ?")
      .run(estadoNuevo, req.params.id);

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
    } else {
      // ARREGLO: antes, si el estudio lo pedia Recepcion o Guardia, el
      // campo de medico quedaba en null y el informe se cargaba sin que
      // se enterara NADIE. Ahora vuelve al modulo que lo solicito.
      const destino = actual.origen_modulo || 'recepcion';
      emitirNotificacion({
        destinoRol: destino,
        tipo: 'informe_listo',
        titulo: 'Informe de imágenes disponible',
        mensaje: `${actual.tipo_estudio}${actual.region ? ` (${actual.region})` : ''} — informe cargado`,
        pacienteId: actual.paciente_id,
      });
      emitirActualizacion({ destinos: [destino], recurso: 'estudios_imagenes' });
    }

    const row = await db.prepare(`SELECT * FROM estudios_imagenes WHERE id = ?`).get(req.params.id);
    res.json(row);
  } catch (err) { next(err); }
});

module.exports = router;

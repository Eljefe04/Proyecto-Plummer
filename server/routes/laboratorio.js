const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId, parseJsonSafe } = require('./_utils');

// ------------------------------------------------------------
// CATALOGO DE ESTUDIOS
//
// Antes el medico escribia el nombre del estudio a mano en un campo
// libre, asi que lo que pedia y lo que el laboratorio cargaba nunca
// coincidian. Cada estudio trae sus analitos con unidad y rango de
// referencia, para poder cargar resultados estructurados y marcar
// en rojo lo que esta fuera de rango.
// ------------------------------------------------------------
const CATALOGO = {
  'Hemograma completo': [
    { analito: 'Hemoglobina', unidad: 'g/dL', min: 12, max: 17 },
    { analito: 'Hematocrito', unidad: '%', min: 36, max: 50 },
    { analito: 'Leucocitos', unidad: '/mm3', min: 4000, max: 11000 },
    { analito: 'Plaquetas', unidad: '/mm3', min: 150000, max: 450000 },
  ],
  'Glucemia': [{ analito: 'Glucosa', unidad: 'mg/dL', min: 70, max: 110 }],
  'Perfil lipidico': [
    { analito: 'Colesterol total', unidad: 'mg/dL', min: 0, max: 200 },
    { analito: 'HDL', unidad: 'mg/dL', min: 40, max: 90 },
    { analito: 'LDL', unidad: 'mg/dL', min: 0, max: 130 },
    { analito: 'Trigliceridos', unidad: 'mg/dL', min: 0, max: 150 },
  ],
  'Hepatograma': [
    { analito: 'TGO (AST)', unidad: 'U/L', min: 0, max: 40 },
    { analito: 'TGP (ALT)', unidad: 'U/L', min: 0, max: 41 },
    { analito: 'Bilirrubina total', unidad: 'mg/dL', min: 0.2, max: 1.2 },
  ],
  'Funcion renal': [
    { analito: 'Urea', unidad: 'mg/dL', min: 15, max: 45 },
    { analito: 'Creatinina', unidad: 'mg/dL', min: 0.6, max: 1.3 },
  ],
  'Coagulograma': [
    { analito: 'Tiempo de protrombina', unidad: '%', min: 70, max: 120 },
    { analito: 'KPTT', unidad: 'seg', min: 25, max: 40 },
  ],
  'Ionograma': [
    { analito: 'Sodio', unidad: 'mEq/L', min: 135, max: 145 },
    { analito: 'Potasio', unidad: 'mEq/L', min: 3.5, max: 5.1 },
  ],
  'Orina completa': [
    { analito: 'Densidad', unidad: '', min: 1005, max: 1030 },
    { analito: 'pH', unidad: '', min: 5, max: 8 },
  ],
  'Perfil tiroideo': [
    { analito: 'TSH', unidad: 'uUI/mL', min: 0.4, max: 4.5 },
    { analito: 'T4 libre', unidad: 'ng/dL', min: 0.8, max: 1.8 },
  ],
  'Proteina C reactiva': [{ analito: 'PCR', unidad: 'mg/L', min: 0, max: 5 }],
};

const router = express.Router();
router.use(middlewareAuth);

router.get('/catalogo', (req, res) => {
  res.json(Object.entries(CATALOGO).map(([nombre, analitos]) => ({ nombre, analitos })));
});

// Panel de metricas para la cabecera del modulo.
router.get('/metricas', async (req, res, next) => {
  try {
    const m = await db.prepare(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'pendiente')                   AS pendientes,
        COUNT(*) FILTER (WHERE estado IN ('muestra_tomada','en_proceso')) AS en_curso,
        COUNT(*) FILTER (WHERE estado = 'pendiente' AND prioridad = 'urgente') AS urgentes,
        COUNT(*) FILTER (WHERE estado = 'realizado'
                          AND completado_en::date = CURRENT_DATE)      AS hechos_hoy
      FROM estudios_laboratorio
    `).get();
    res.json(m);
  } catch (err) { next(err); }
});

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
    const salida = [];
    for (const row of rows.map(hidratar)) {
      salida.push({ ...row, valores: await valoresDe(row.id) });
    }
    res.json(salida);
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

// Estado intermedio: muestra tomada / en proceso. Antes el estudio
// saltaba de "pendiente" a "realizado" sin nada en el medio.
router.patch('/:id/estado', requireRol('laboratorio', 'administrador'), async (req, res, next) => {
  try {
    const { estado } = req.body;
    const validos = ['pendiente', 'muestra_tomada', 'en_proceso', 'realizado'];
    if (!validos.includes(estado)) {
      return res.status(400).json({ error: `Estado no valido. Debe ser uno de: ${validos.join(', ')}` });
    }
    const actual = await db.prepare('SELECT * FROM estudios_laboratorio WHERE id = ?').get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Estudio no encontrado' });

    await db.prepare('UPDATE estudios_laboratorio SET estado = ? WHERE id = ?').run(estado, req.params.id);
    emitirActualizacion({ salas: ['rol:laboratorio', 'rol:medico'], recurso: 'estudios_laboratorio' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch('/:id/resultado', requireRol('laboratorio', 'administrador'), async (req, res, next) => {
  try {
    const { resultado, valores } = req.body;
    const actual = await db.prepare(`SELECT * FROM estudios_laboratorio WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Estudio no encontrado' });

    await db.transaccion(async (tx) => {
      await tx.prepare(`
        UPDATE estudios_laboratorio SET resultado = ?, estado = 'realizado', completado_en = NOW() WHERE id = ?
      `).run(resultado || null, req.params.id);

      // Los valores se reemplazan por completo: permite corregir una carga.
      await tx.prepare('DELETE FROM laboratorio_resultados WHERE estudio_id = ?').run(req.params.id);

      if (Array.isArray(valores)) {
        let orden = 0;
        for (const v of valores) {
          if (!v.analito || v.valor === '' || v.valor === null || v.valor === undefined) continue;
          await tx.prepare(`
            INSERT INTO laboratorio_resultados (id, estudio_id, analito, valor, unidad, ref_min, ref_max, orden)
            VALUES (?,?,?,?,?,?,?,?)
          `).run(nuevoId(), req.params.id, v.analito, String(v.valor),
                 v.unidad || null, v.min ?? null, v.max ?? null, orden++);
        }
      }
    });

    const paciente = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(actual.paciente_id);
    const listaValores = await valoresDe(req.params.id);
    const alterados = listaValores.filter((v) => v.fuera_de_rango).length;

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
        mensaje: `${paciente.nombre} ${paciente.apellido} — resultado disponible` +
          (alterados > 0 ? ` · ${alterados} valor${alterados > 1 ? 'es' : ''} fuera de rango` : ''),
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

/**
 * Devuelve los valores de un estudio marcando cuales quedaron fuera del
 * rango de referencia, para poder pintarlos en rojo en la pantalla.
 */
async function valoresDe(estudioId) {
  const filas = await db.prepare(
    'SELECT * FROM laboratorio_resultados WHERE estudio_id = ? ORDER BY orden'
  ).all(estudioId);

  return filas.map((f) => {
    const n = Number(f.valor);
    let fuera = false;
    let direccion = null;
    if (!Number.isNaN(n)) {
      if (f.ref_min !== null && n < Number(f.ref_min)) { fuera = true; direccion = 'bajo'; }
      if (f.ref_max !== null && n > Number(f.ref_max)) { fuera = true; direccion = 'alto'; }
    }
    return { ...f, fuera_de_rango: fuera, direccion };
  });
}

module.exports = router;

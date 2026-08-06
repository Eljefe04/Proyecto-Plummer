const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { nuevoId } = require('./_utils');

const router = express.Router();
router.use(middlewareAuth);

function calcularEdadGestacional(fum) {
  const dias = Math.floor((Date.now() - new Date(fum).getTime()) / (1000 * 60 * 60 * 24));
  const semanas = Math.floor(dias / 7);
  const diasRestantes = dias % 7;
  const fpp = new Date(new Date(fum).getTime() + 280 * 24 * 60 * 60 * 1000);
  return { semanas, dias: diasRestantes, fechaProbableParto: fpp.toISOString().slice(0, 10) };
}

// -------- OBSTETRICIA --------
router.get('/obstetricia/calculadora/:pacienteId', (req, res) => {
  const { fum } = req.query;
  if (!fum) return res.status(400).json({ error: 'Debe indicar la FUM' });
  res.json(calcularEdadGestacional(fum));
});

router.get('/obstetricia/controles/:pacienteId', async (req, res, next) => {
  try {
    const rows = await db.prepare(`SELECT * FROM obstetricia_controles WHERE paciente_id = ? ORDER BY fecha_control`).all(req.params.pacienteId);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/obstetricia/controles', requireRol('medico', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    const id = nuevoId();
    await db.prepare(`
      INSERT INTO obstetricia_controles (id, paciente_id, fum, peso_kg, semana_gestacion, observaciones)
      VALUES (?,?,?,?,?,?)
    `).run(id, b.paciente_id, b.fum || null, b.peso_kg || null, b.semana_gestacion || null, b.observaciones || null);
    res.status(201).json(await db.prepare(`SELECT * FROM obstetricia_controles WHERE id = ?`).get(id));
  } catch (err) { next(err); }
});

router.get('/obstetricia/ecografias/:pacienteId', async (req, res, next) => {
  try {
    const rows = await db.prepare(`SELECT * FROM obstetricia_ecografias WHERE paciente_id = ? ORDER BY fecha DESC`).all(req.params.pacienteId);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/obstetricia/ecografias', requireRol('medico', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    const id = nuevoId();
    await db.prepare(`
      INSERT INTO obstetricia_ecografias (id, paciente_id, fecha, semana_gestacion, observaciones, archivo_nombre)
      VALUES (?,?,?,?,?,?)
    `).run(id, b.paciente_id, b.fecha, b.semana_gestacion || null, b.observaciones || null, b.archivo_nombre || null);
    res.status(201).json(await db.prepare(`SELECT * FROM obstetricia_ecografias WHERE id = ?`).get(id));
  } catch (err) { next(err); }
});

// -------- CARDIOLOGIA --------
router.get('/cardiologia/marcapasos/:pacienteId', async (req, res, next) => {
  try {
    const rows = await db.prepare(`SELECT * FROM cardiologia_marcapasos WHERE paciente_id = ? ORDER BY fecha_implante DESC`).all(req.params.pacienteId);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/cardiologia/marcapasos', requireRol('medico', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    const id = nuevoId();
    await db.prepare(`
      INSERT INTO cardiologia_marcapasos (id, paciente_id, modelo, fecha_implante, parametros)
      VALUES (?,?,?,?,?)
    `).run(id, b.paciente_id, b.modelo || null, b.fecha_implante || null, b.parametros || null);
    res.status(201).json(await db.prepare(`SELECT * FROM cardiologia_marcapasos WHERE id = ?`).get(id));
  } catch (err) { next(err); }
});

router.get('/cardiologia/ecg/:pacienteId', async (req, res, next) => {
  try {
    const rows = await db.prepare(`SELECT * FROM cardiologia_ecg WHERE paciente_id = ? ORDER BY fecha DESC`).all(req.params.pacienteId);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/cardiologia/ecg', requireRol('medico', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    const id = nuevoId();
    await db.prepare(`
      INSERT INTO cardiologia_ecg (id, paciente_id, fecha, observaciones, archivo_nombre)
      VALUES (?,?,?,?,?)
    `).run(id, b.paciente_id, b.fecha, b.observaciones || null, b.archivo_nombre || null);
    res.status(201).json(await db.prepare(`SELECT * FROM cardiologia_ecg WHERE id = ?`).get(id));
  } catch (err) { next(err); }
});

// -------- NEUROLOGIA --------
router.get('/neurologia/seguimientos/:pacienteId', async (req, res, next) => {
  try {
    const rows = await db.prepare(`SELECT * FROM neurologia_seguimientos WHERE paciente_id = ? ORDER BY fecha DESC`).all(req.params.pacienteId);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/neurologia/seguimientos', requireRol('medico', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    const id = nuevoId();
    await db.prepare(`
      INSERT INTO neurologia_seguimientos (id, paciente_id, sintomas, escala_progresion, observaciones)
      VALUES (?,?,?,?,?)
    `).run(id, b.paciente_id, b.sintomas || null, b.escala_progresion || null, b.observaciones || null);
    res.status(201).json(await db.prepare(`SELECT * FROM neurologia_seguimientos WHERE id = ?`).get(id));
  } catch (err) { next(err); }
});

// -------- PEDIATRIA --------
router.get('/pediatria/vacunas/:pacienteId', async (req, res, next) => {
  try {
    const rows = await db.prepare(`SELECT * FROM pediatria_vacunas WHERE paciente_id = ? ORDER BY fecha_aplicacion`).all(req.params.pacienteId);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/pediatria/vacunas', requireRol('medico', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    const id = nuevoId();
    await db.prepare(`
      INSERT INTO pediatria_vacunas (id, paciente_id, vacuna, fecha_aplicacion, proxima_dosis, estado)
      VALUES (?,?,?,?,?,?)
    `).run(id, b.paciente_id, b.vacuna, b.fecha_aplicacion || null, b.proxima_dosis || null, b.estado || 'pendiente');
    res.status(201).json(await db.prepare(`SELECT * FROM pediatria_vacunas WHERE id = ?`).get(id));
  } catch (err) { next(err); }
});

router.get('/pediatria/percentiles/:pacienteId', async (req, res, next) => {
  try {
    const rows = await db.prepare(`SELECT * FROM pediatria_percentiles WHERE paciente_id = ? ORDER BY fecha`).all(req.params.pacienteId);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/pediatria/percentiles', requireRol('medico', 'administrador'), async (req, res, next) => {
  try {
    const b = req.body;
    const id = nuevoId();
    await db.prepare(`
      INSERT INTO pediatria_percentiles (id, paciente_id, peso_kg, talla_cm, perimetro_cefalico_cm, edad_meses)
      VALUES (?,?,?,?,?,?)
    `).run(id, b.paciente_id, b.peso_kg || null, b.talla_cm || null, b.perimetro_cefalico_cm || null, b.edad_meses || null);
    res.status(201).json(await db.prepare(`SELECT * FROM pediatria_percentiles WHERE id = ?`).get(id));
  } catch (err) { next(err); }
});

module.exports = router;

const express = require('express');
const db = require('../db/index');
const { middlewareAuth } = require('../middleware/auth');

const router = express.Router();
router.use(middlewareAuth);

router.get('/', async (req, res, next) => {
  try {
    const hoy = new Date().toISOString().slice(0, 10);

    const pacientesRegistrados = (await db.prepare(`SELECT COUNT(*) AS c FROM pacientes WHERE estado != 'inactivo'`).get()).c;
    const turnosHoy = (await db.prepare(`SELECT COUNT(*) AS c FROM turnos WHERE fecha = ?`).get(hoy)).c;
    const camasTotales = (await db.prepare(`SELECT COUNT(*) AS c FROM camas`).get()).c;
    const camasOcupadas = (await db.prepare(`SELECT COUNT(*) AS c FROM camas WHERE estado = 'ocupada'`).get()).c;
    const estudiosLabPendientes = (await db.prepare(`SELECT COUNT(*) AS c FROM estudios_laboratorio WHERE estado = 'pendiente'`).get()).c;
    const estudiosImgPendientes = (await db.prepare(`SELECT COUNT(*) AS c FROM estudios_imagenes WHERE estado = 'pendiente'`).get()).c;

    const alertasStock = await db.prepare(`
      SELECT nombre, stock, stock_minimo FROM medicamentos WHERE stock < stock_minimo ORDER BY (stock * 1.0 / stock_minimo) ASC
    `).all();

    const ingresosRecientesGuardia = await db.prepare(`
      SELECT g.id, g.nivel_triage, g.motivo_consulta, g.derivacion_destino, g.protocolo_nn, g.nombre_temporal,
             p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
      FROM guardia_ingresos g
      LEFT JOIN pacientes p ON p.id = g.paciente_id
      ORDER BY g.creado_en DESC LIMIT 5
    `).all();

    res.json({
      pacientesRegistrados: Number(pacientesRegistrados),
      turnosHoy: Number(turnosHoy),
      camasOcupadas: Number(camasOcupadas),
      camasTotales: Number(camasTotales),
      estudiosPendientes: Number(estudiosLabPendientes) + Number(estudiosImgPendientes),
      alertasStock,
      ingresosRecientesGuardia,
    });
  } catch (err) { next(err); }
});

module.exports = router;

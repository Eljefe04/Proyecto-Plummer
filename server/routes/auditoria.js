const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');

const router = express.Router();
router.use(middlewareAuth);
router.use(requireRol('administrador'));

router.get('/', async (req, res, next) => {
  try {
    const { q, accion, modulo } = req.query;
    let sql = `SELECT * FROM auditoria WHERE 1=1`;
    const params = [];

    if (q) {
      sql += ` AND (usuario ILIKE ? OR descripcion ILIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    if (accion) {
      sql += ` AND accion = ?`;
      params.push(accion);
    }
    if (modulo) {
      sql += ` AND modulo = ?`;
      params.push(modulo);
    }
    sql += ` ORDER BY creado_en DESC LIMIT 200`;

    const rows = await db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/resumen', async (req, res, next) => {
  try {
    const total = (await db.prepare(`SELECT COUNT(*) AS c FROM auditoria`).get()).c;
    const creaciones = (await db.prepare(`SELECT COUNT(*) AS c FROM auditoria WHERE accion = 'creacion'`).get()).c;
    const modificaciones = (await db.prepare(`SELECT COUNT(*) AS c FROM auditoria WHERE accion = 'modificacion'`).get()).c;
    const accesosHce = (await db.prepare(`SELECT COUNT(*) AS c FROM auditoria WHERE accion = 'acceso_hce'`).get()).c;

    res.json({
      total: Number(total),
      creaciones: Number(creaciones),
      modificaciones: Number(modificaciones),
      accesosHce: Number(accesosHce),
    });
  } catch (err) { next(err); }
});

module.exports = router;

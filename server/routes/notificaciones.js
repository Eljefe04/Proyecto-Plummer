const express = require('express');
const db = require('../db/index');
const { middlewareAuth } = require('../middleware/auth');

const router = express.Router();
router.use(middlewareAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rol, medicoId } = req.sesion;
    let rows;
    if (medicoId) {
      rows = await db.prepare(`
        SELECT * FROM notificaciones
        WHERE (destino_rol = ? OR destino_medico_id = ?)
        ORDER BY creado_en DESC LIMIT 30
      `).all(rol, medicoId);
    } else {
      rows = await db.prepare(`
        SELECT * FROM notificaciones WHERE destino_rol = ? ORDER BY creado_en DESC LIMIT 30
      `).all(rol);
    }
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/:id/leida', async (req, res, next) => {
  try {
    await db.prepare(`UPDATE notificaciones SET leida = true WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;

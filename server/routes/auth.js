const express = require('express');
const db = require('../db/index');
const { crearSesion, eliminarSesion, middlewareAuth } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');

const router = express.Router();

router.get('/especialidades', (req, res) => {
  res.json([
    { valor: 'obstetricia', label: 'Obstetricia', terminal: 'Terminal 1' },
    { valor: 'cardiologia', label: 'Cardiologia', terminal: 'Terminal 2' },
    { valor: 'neurologia', label: 'Neurologia', terminal: 'Terminal 3' },
    { valor: 'pediatria', label: 'Pediatria', terminal: 'Terminal 4' },
  ]);
});

router.post('/login', async (req, res, next) => {
  try {
    const { rol, usuario, password, especialidad } = req.body;

    if (!rol || !usuario || !password) {
      return res.status(400).json({ error: 'Faltan datos de acceso' });
    }

    let row;

    if (rol === 'medico') {
      if (!especialidad) {
        return res.status(400).json({ error: 'Debe seleccionar una especialidad' });
      }
      row = await db.prepare(`
        SELECT u.* FROM usuarios u
        JOIN medicos m ON m.id = u.medico_id
        WHERE u.rol = 'medico'
          AND lower(u.usuario) = lower(?)
          AND u.password = ?
          AND m.especialidad = ?
          AND u.activo = true
          AND m.estado = 'activo'
      `).get(usuario, password, especialidad);
    } else {
      row = await db.prepare(`
        SELECT * FROM usuarios
        WHERE rol = ? AND lower(usuario) = lower(?) AND password = ? AND activo = true
      `).get(rol, usuario, password);
    }

    if (!row) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = await crearSesion(row, especialidad || null);

    await registrarAuditoria({
      usuario: row.nombre_completo,
      rol: row.rol,
      accion: 'login',
      modulo: 'autenticacion',
      descripcion: `Inicio de sesion de ${row.nombre_completo} (${row.rol})`,
    });

    res.json({
      token,
      usuario: {
        nombreCompleto: row.nombre_completo,
        rol: row.rol,
        medicoId: row.medico_id || null,
      },
    });
  } catch (err) { next(err); }
});

router.post('/logout', middlewareAuth, async (req, res, next) => {
  try {
    await eliminarSesion(req.headers['x-session-token']);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/me', middlewareAuth, (req, res) => {
  res.json({ usuario: req.sesion });
});

module.exports = router;

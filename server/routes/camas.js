const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { registrarAuditoria } = require('../db/auditoria');

const router = express.Router();
router.use(middlewareAuth);

// Minutos que una cama permanece en limpieza antes de quedar libre.
// Configurable por variable de entorno para poder bajarlo a 1 en una demo.
const MINUTOS_LIMPIEZA = Number(process.env.MINUTOS_LIMPIEZA || 5);

// ------------------------------------------------------------
// Estado calculado de la cama.
//
// La limpieza NO se resuelve con un setTimeout en Node: Render duerme
// el servicio a los ~15 minutos y lo reinicia en cada deploy, asi que
// un temporizador en memoria se perderia y la cama quedaria en limpieza
// para siempre. En su lugar se guarda `limpieza_desde` y el estado se
// deduce de la hora: sobrevive a cualquier reinicio.
// ------------------------------------------------------------
function hidratar(cama) {
  if (!cama) return cama;
  const salida = { ...cama, minutos_limpieza: MINUTOS_LIMPIEZA };

  if (cama.estado === 'limpieza' && cama.limpieza_desde) {
    const transcurrido = Date.now() - new Date(cama.limpieza_desde).getTime();
    const restante = MINUTOS_LIMPIEZA * 60000 - transcurrido;
    if (restante <= 0) {
      salida.estado = 'libre';
      salida.limpieza_desde = null;
      salida.segundos_restantes = 0;
    } else {
      salida.segundos_restantes = Math.ceil(restante / 1000);
    }
  } else {
    salida.segundos_restantes = null;
  }
  return salida;
}

async function listarCamas() {
  const filas = await db.prepare(`
    SELECT c.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido, p.dni AS paciente_dni
    FROM camas c
    LEFT JOIN pacientes p ON p.id = c.paciente_id
    ORDER BY c.sector, c.codigo
  `).all();
  return filas.map(hidratar);
}

// ------------------------------------------------------------
// Promocion periodica: pasa a libre las camas que ya cumplieron
// su tiempo de limpieza y avisa a las terminales para que la
// pantalla cambie sola, sin recargar.
// ------------------------------------------------------------
async function promoverCamasLimpias() {
  try {
    const { changes } = await db.prepare(`
      UPDATE camas
      SET estado = 'libre', limpieza_desde = NULL
      WHERE estado = 'limpieza'
        AND limpieza_desde IS NOT NULL
        AND limpieza_desde < NOW() - (? * INTERVAL '1 minute')
    `).run(MINUTOS_LIMPIEZA);

    if (changes > 0) {
      emitirActualizacion({
        salas: ['rol:enfermeria', 'rol:recepcion', 'rol:quirofano', 'rol:medico'],
        recurso: 'camas',
        datos: await listarCamas(),
      });
    }
  } catch (err) {
    console.error('[camas] error al promover camas en limpieza:', err.message);
  }
}

db.listo
  .then(() => {
    promoverCamasLimpias();
    setInterval(promoverCamasLimpias, 30000).unref();
  })
  .catch(() => {});

function difundirCamas(extra = []) {
  listarCamas()
    .then((datos) =>
      emitirActualizacion({
        salas: ['rol:enfermeria', 'rol:recepcion', 'rol:quirofano', 'rol:medico', ...extra],
        recurso: 'camas',
        datos,
      })
    )
    .catch(() => {});
}

// ------------------------------------------------------------
// GET /api/camas
// ------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    res.json(await listarCamas());
  } catch (err) { next(err); }
});

// GET /api/camas/libres?sector=internacion
router.get('/libres', async (req, res, next) => {
  try {
    const { sector } = req.query;
    const filas = await db.prepare(`
      SELECT * FROM camas
      WHERE (? IS NULL OR sector = ?)
      ORDER BY sector, codigo
    `).all(sector || null, sector || null);
    res.json(filas.map(hidratar).filter((c) => c.estado === 'libre'));
  } catch (err) { next(err); }
});

// ------------------------------------------------------------
// PATCH /api/camas/:id/asignar
//
// ARREGLO CENTRAL: antes solo marcaba la cama como ocupada y nunca
// tocaba al paciente. Como la pantalla de Internacion lista pacientes
// con estado = 'internado', y ese estado no lo escribia NINGUNA ruta
// del sistema, la lista de internados estaba garantizado que
// apareciera siempre vacia.
// ------------------------------------------------------------
router.patch('/:id/asignar', requireRol('enfermeria', 'recepcion', 'quirofano', 'medico', 'administrador'),
  async (req, res, next) => {
    try {
      const { paciente_id, medico_a_cargo_id = null, alta_estimada = null } = req.body;
      if (!paciente_id) return res.status(400).json({ error: 'Falta el paciente' });

      const resultado = await db.transaccion(async (tx) => {
        const cama = await tx.prepare('SELECT * FROM camas WHERE id = ?').get(req.params.id);
        if (!cama) return { error: 'La cama no existe', status: 404 };

        const camaHidratada = hidratar(cama);
        if (camaHidratada.estado === 'ocupada') {
          return { error: `La cama ${cama.codigo} ya esta ocupada`, status: 409 };
        }
        if (camaHidratada.estado === 'limpieza') {
          return {
            error: `La cama ${cama.codigo} esta en limpieza (faltan ${camaHidratada.segundos_restantes} s)`,
            status: 409,
          };
        }

        const paciente = await tx.prepare('SELECT * FROM pacientes WHERE id = ?').get(paciente_id);
        if (!paciente) return { error: 'El paciente no existe', status: 404 };

        const yaTiene = await tx.prepare(
          'SELECT codigo FROM camas WHERE paciente_id = ? AND id <> ?'
        ).get(paciente_id, req.params.id);
        if (yaTiene) {
          return { error: `El paciente ya ocupa la cama ${yaTiene.codigo}`, status: 409 };
        }

        await tx.prepare(
          "UPDATE camas SET estado = 'ocupada', paciente_id = ?, limpieza_desde = NULL WHERE id = ?"
        ).run(paciente_id, req.params.id);

        await tx.prepare(
          "UPDATE pacientes SET estado = 'internado', alta_estimada = ?, medico_a_cargo_id = ? WHERE id = ?"
        ).run(alta_estimada, medico_a_cargo_id, paciente_id);

        return { cama, paciente };
      });

      if (resultado.error) {
        return res.status(resultado.status).json({ error: resultado.error });
      }

      const { cama, paciente } = resultado;
      const nombre = `${paciente.apellido}, ${paciente.nombre}`;

      await registrarAuditoria({
        usuario: req.sesion.nombreCompleto,
        rol: req.sesion.rol,
        accion: 'modificacion',
        modulo: 'camas',
        descripcion: `Asigno la cama ${cama.codigo} a ${nombre} (paciente internado)`,
      });

      emitirNotificacion({
        destinoRol: 'enfermeria',
        tipo: 'paciente_internado',
        titulo: 'Paciente internado',
        mensaje: `${nombre} ocupa la cama ${cama.codigo} (${cama.sector.replace('_', ' ')})`,
        pacienteId: paciente_id,
      });

      difundirCamas();
      emitirActualizacion({ salas: ['rol:enfermeria', 'rol:medico'], recurso: 'internados' });

      res.json({ ok: true });
    } catch (err) { next(err); }
  });

// ------------------------------------------------------------
// PATCH /api/camas/:id/liberar
// La cama pasa a limpieza con marca horaria; el paciente vuelve a
// ambulatorio si no tiene otra cama asignada.
// ------------------------------------------------------------
router.patch('/:id/liberar', requireRol('enfermeria', 'recepcion', 'quirofano', 'administrador'),
  async (req, res, next) => {
    try {
      const resultado = await db.transaccion(async (tx) => {
        const cama = await tx.prepare('SELECT * FROM camas WHERE id = ?').get(req.params.id);
        if (!cama) return { error: 'La cama no existe', status: 404 };

        let paciente = null;
        if (cama.paciente_id) {
          paciente = await tx.prepare('SELECT * FROM pacientes WHERE id = ?').get(cama.paciente_id);
          await tx.prepare(
            "UPDATE pacientes SET estado = 'ambulatorio', alta_estimada = NULL WHERE id = ?"
          ).run(cama.paciente_id);
        }

        await tx.prepare(
          "UPDATE camas SET estado = 'limpieza', paciente_id = NULL, limpieza_desde = NOW() WHERE id = ?"
        ).run(req.params.id);

        return { cama, paciente };
      });

      if (resultado.error) return res.status(resultado.status).json({ error: resultado.error });

      const { cama, paciente } = resultado;
      const quien = paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'sin paciente';

      await registrarAuditoria({
        usuario: req.sesion.nombreCompleto,
        rol: req.sesion.rol,
        accion: 'modificacion',
        modulo: 'camas',
        descripcion: `Libero la cama ${cama.codigo} (${quien}). Queda en limpieza ${MINUTOS_LIMPIEZA} min.`,
      });

      difundirCamas();
      emitirActualizacion({ salas: ['rol:enfermeria', 'rol:medico'], recurso: 'internados' });

      res.json({ ok: true, minutos_limpieza: MINUTOS_LIMPIEZA });
    } catch (err) { next(err); }
  });

// ------------------------------------------------------------
// PATCH /api/camas/:id/marcar-libre
// Atajo manual para saltear la espera de limpieza (util en una demo).
// ------------------------------------------------------------
router.patch('/:id/marcar-libre', requireRol('enfermeria', 'recepcion', 'administrador'),
  async (req, res, next) => {
    try {
      const cama = await db.prepare('SELECT * FROM camas WHERE id = ?').get(req.params.id);
      if (!cama) return res.status(404).json({ error: 'La cama no existe' });

      await db.prepare(
        "UPDATE camas SET estado = 'libre', paciente_id = NULL, limpieza_desde = NULL WHERE id = ?"
      ).run(req.params.id);

      await registrarAuditoria({
        usuario: req.sesion.nombreCompleto,
        rol: req.sesion.rol,
        accion: 'modificacion',
        modulo: 'camas',
        descripcion: `Marco la cama ${cama.codigo} como libre manualmente`,
      });

      difundirCamas();
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

// ------------------------------------------------------------
// POST /api/camas  — alta de cama
// ------------------------------------------------------------
router.post('/', requireRol('administrador', 'enfermeria'), async (req, res, next) => {
  try {
    const { codigo, sector, habitacion = null } = req.body;
    if (!codigo || !sector) return res.status(400).json({ error: 'Faltan codigo y sector' });

    const existente = await db.prepare('SELECT id FROM camas WHERE codigo = ?').get(codigo);
    if (existente) return res.status(409).json({ error: `Ya existe una cama con el codigo ${codigo}` });

    const id = uuidv4();
    await db.prepare(
      "INSERT INTO camas (id, codigo, sector, habitacion, estado) VALUES (?, ?, ?, ?, 'libre')"
    ).run(id, codigo, sector, habitacion);

    await registrarAuditoria({
        usuario: req.sesion.nombreCompleto,
        rol: req.sesion.rol,
        accion: 'creacion',
        modulo: 'camas',
        descripcion: `Creo la cama ${codigo} en ${sector}`,
      });
    difundirCamas();
    res.status(201).json({ id, ok: true });
  } catch (err) { next(err); }
});

// El router se exporta como modulo principal (index.js hace app.use con esto).
// Los helpers van como propiedades para que otras rutas los reutilicen:
//   const camas = require('./camas'); camas.difundirCamas();
module.exports = router;
module.exports.listarCamas = listarCamas;
module.exports.difundirCamas = difundirCamas;
module.exports.hidratar = hidratar;
module.exports.MINUTOS_LIMPIEZA = MINUTOS_LIMPIEZA;

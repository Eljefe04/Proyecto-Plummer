const express = require('express');
const db = require('../db/index');
const { middlewareAuth } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { emitirNotificacion, emitirActualizacion } = require('../sockets/notificaciones');
const { nuevoId } = require('./_utils');
const { internarPaciente, requiereCama, NOMBRE_SECTOR } = require('./_internacion');

const router = express.Router();
router.use(middlewareAuth);

// ------------------------------------------------------------
// Destinos validos de derivacion.
//
// Laboratorio, Imagenes y Farmacia quedan FUERA a proposito: no son
// derivaciones de un paciente, son pedidos de estudio y recetas, y ya
// tienen su propio circuito. Tenerlos en los dos lados generaba dos
// caminos paralelos que producian registros distintos para lo mismo.
// ------------------------------------------------------------
const DESTINOS_VALIDOS = [
  'obstetricia', 'cardiologia', 'neurologia', 'pediatria',
  'cirugia', 'anestesiologia',
  'internacion', 'terapia_intensiva', 'guardia',
];

router.get('/', async (req, res, next) => {
  try {
    const { paciente_id, destino, estado } = req.query;
    const rows = await db.prepare(`
      SELECT d.*,
             p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
             p.dni AS paciente_dni, p.estado AS paciente_estado,
             c.codigo AS cama_codigo, c.sector AS cama_sector
      FROM derivaciones d
      LEFT JOIN pacientes p ON p.id = d.paciente_id
      LEFT JOIN camas c     ON c.paciente_id = d.paciente_id
      WHERE (CAST(? AS TEXT) IS NULL OR d.paciente_id = ?)
        AND (CAST(? AS TEXT) IS NULL OR d.destino = ?)
        AND (CAST(? AS TEXT) IS NULL OR d.estado = ?)
      ORDER BY
        CASE WHEN d.prioridad = 'urgente' THEN 0 ELSE 1 END,
        d.creado_en DESC
    `).all(
      paciente_id || null, paciente_id || null,
      destino || null, destino || null,
      estado || null, estado || null,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// Bandeja de Enfermeria: lo que le llego a Internacion, UTI o Guardia.
router.get('/enfermeria', async (req, res, next) => {
  try {
    const rows = await db.prepare(`
      SELECT d.*,
             p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
             p.dni AS paciente_dni, p.estado AS paciente_estado,
             c.codigo AS cama_codigo, c.sector AS cama_sector
      FROM derivaciones d
      LEFT JOIN pacientes p ON p.id = d.paciente_id
      LEFT JOIN camas c     ON c.paciente_id = d.paciente_id
      WHERE d.destino IN ('internacion', 'terapia_intensiva', 'guardia')
      ORDER BY
        CASE WHEN d.prioridad = 'urgente' THEN 0 ELSE 1 END,
        d.creado_en DESC
      LIMIT 60
    `).all();
    res.json(rows);
  } catch (err) { next(err); }
});

// ------------------------------------------------------------
// POST /api/derivaciones
//
// Ahora la derivacion NO se limita a dejar un registro y avisar:
// si el destino es Internacion, UTI o Guardia, busca cama libre en
// ese sector, la asigna y marca al paciente como internado. Todo en
// una transaccion.
// ------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.paciente_id || !b.origen || !b.destino) {
      return res.status(400).json({ error: 'Paciente, origen y destino son obligatorios' });
    }
    if (!DESTINOS_VALIDOS.includes(b.destino)) {
      return res.status(400).json({ error: `Destino no válido: ${b.destino}` });
    }

    const paciente = await db.prepare('SELECT * FROM pacientes WHERE id = ?').get(b.paciente_id);
    if (!paciente) return res.status(404).json({ error: 'El paciente no existe' });

    const prioridad = b.prioridad === 'urgente' ? 'urgente' : 'normal';
    const id = nuevoId();

    const resultado = await db.transaccion(async (tx) => {
      await tx.prepare(`
        INSERT INTO derivaciones (id, paciente_id, origen, destino, motivo, derivado_por, prioridad)
        VALUES (?,?,?,?,?,?,?)
      `).run(id, b.paciente_id, b.origen, b.destino, b.motivo || null, req.sesion.nombreCompleto, prioridad);

      // ------------------------------------------------------------
      // Derivar a Cirugia CREA la cirugia, no solo el registro de
      // derivacion. Si es urgente, entra como tal y cae en el acto en
      // la bandeja de Quirofano: esa es la "cirugia en el momento".
      // ------------------------------------------------------------
      if (b.destino === 'cirugia') {
        await tx.prepare(`
          INSERT INTO cirugias (id, paciente_id, tipo_cirugia, caracter, estado,
                                solicitado_por_medico_id, notas_prequirurgicas)
          VALUES (?,?,?,?,'solicitada',?,?)
        `).run(
          nuevoId(), b.paciente_id,
          b.tipo_cirugia || 'A definir por Quirófano',
          prioridad === 'urgente' ? 'urgente' : 'programada',
          b.medico_a_cargo_id || req.sesion.medicoId || null,
          b.motivo || null,
        );
        return { internacion: null, creoCirugia: true };
      }

      if (!requiereCama(b.destino)) return { internacion: null };

      const internacion = await internarPaciente(tx, {
        pacienteId: b.paciente_id,
        destino: b.destino,
        medicoACargoId: b.medico_a_cargo_id || null,
      });
      return { internacion };
    });

    const nombre = `${paciente.apellido}, ${paciente.nombre}`;
    const inter = resultado.internacion;
    const sectorNombre = NOMBRE_SECTOR[b.destino] || b.destino;

    let detalleCama = '';
    if (inter && inter.ok) {
      detalleCama = inter.yaTenia
        ? ` Ya ocupaba la cama ${inter.cama.codigo}.`
        : ` Cama asignada: ${inter.cama.codigo}.`;
    } else if (inter && inter.motivo === 'sin_camas') {
      detalleCama = ` ATENCIÓN: no hay camas libres en ${sectorNombre}.`;
    }

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'derivaciones',
      descripcion: `Derivación de ${nombre}: ${b.origen} → ${b.destino}${prioridad === 'urgente' ? ' (URGENTE)' : ''}.${detalleCama}`,
      pacienteId: paciente.id,
    });

    emitirNotificacion({
      destinoRol: b.destino,
      tipo: 'derivacion_recibida',
      titulo: prioridad === 'urgente' ? 'Derivación URGENTE' : 'Nueva derivación recibida',
      mensaje: `${nombre} derivado desde ${b.origen}. Motivo: ${b.motivo || 'no especificado'}.${detalleCama}`,
      pacienteId: paciente.id,
      prioridad,
    });

    emitirActualizacion({ destinos: [b.destino], recurso: 'derivaciones' });
    if (resultado.creoCirugia) {
      emitirActualizacion({ salas: ['rol:quirofano'], recurso: 'cirugias' });
    }
    if (inter && inter.ok) {
      emitirActualizacion({
        salas: ['rol:enfermeria', 'rol:recepcion', 'rol:medico', 'rol:quirofano'],
        recurso: 'camas',
      });
      emitirActualizacion({
        salas: ['rol:enfermeria', 'rol:recepcion', 'rol:medico'],
        recurso: 'internados',
      });
    }

    const row = await db.prepare('SELECT * FROM derivaciones WHERE id = ?').get(id);
    res.status(201).json({
      ...row,
      cama_asignada: inter && inter.ok ? inter.cama.codigo : null,
      // Si no había camas se avisa, pero la derivación igual queda
      // registrada: el paciente no puede perderse por falta de cama.
      advertencia: inter && !inter.ok && inter.motivo === 'sin_camas'
        ? `No hay camas libres en ${sectorNombre}. La derivación quedó registrada sin cama.`
        : null,
    });
  } catch (err) { next(err); }
});

// Marcar una derivación como atendida.
router.patch('/:id/atender', async (req, res, next) => {
  try {
    const row = await db.prepare('SELECT * FROM derivaciones WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Derivación no encontrada' });

    await db.prepare("UPDATE derivaciones SET estado = 'atendida' WHERE id = ?").run(req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'derivaciones',
      descripcion: `Derivación marcada como atendida (${row.origen} → ${row.destino})`,
      pacienteId: row.paciente_id,
    });

    emitirActualizacion({ destinos: [row.destino], recurso: 'derivaciones' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;

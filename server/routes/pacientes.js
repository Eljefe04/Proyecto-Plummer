const express = require('express');
const db = require('../db/index');
const { middlewareAuth, requireRol } = require('../middleware/auth');
const { registrarAuditoria } = require('../db/auditoria');
const { nuevoId, parseJsonSafe, AREAS_DERIVACION } = require('./_utils');

const router = express.Router();

router.use(middlewareAuth);

router.get('/areas-derivacion', (req, res) => {
  res.json(AREAS_DERIVACION);
});

router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    let rows;
    if (q) {
      rows = await db.prepare(`
        SELECT * FROM pacientes
        WHERE (nombre || ' ' || apellido) ILIKE ? OR dni ILIKE ?
        ORDER BY apellido, nombre
      `).all(`%${q}%`, `%${q}%`);
    } else {
      rows = await db.prepare(`SELECT * FROM pacientes ORDER BY apellido, nombre`).all();
    }
    res.json(rows.map(hidratar));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Paciente no encontrado' });

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'acceso_hce',
      modulo: 'pacientes',
      descripcion: `Acceso a la HCE de ${row.nombre} ${row.apellido}`,
      pacienteId: row.id,
    });

    res.json(hidratar(row));
  } catch (err) { next(err); }
});

router.post('/', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const b = req.body;

    if (!b.nombre || !b.apellido || !b.dni) {
      return res.status(400).json({ error: 'Nombre, apellido y DNI son obligatorios' });
    }
    if (!/^\d+$/.test(b.dni)) {
      return res.status(400).json({ error: 'El DNI debe contener solo numeros' });
    }
    if (b.cuil && !/^\d+$/.test(b.cuil)) {
      return res.status(400).json({ error: 'El CUIL debe contener solo numeros' });
    }

    const existente = await db.prepare(`SELECT id FROM pacientes WHERE dni = ?`).get(b.dni);
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un paciente registrado con ese DNI' });
    }

    const id = nuevoId();
    const coberturaMedica = b.tipo_cobertura === 'particular' ? null : (b.cobertura_medica || null);

    await db.prepare(`
      INSERT INTO pacientes (
        id, nombre, apellido, dni, cuil, fecha_nacimiento, genero, nacionalidad,
        telefono, email, domicilio, localidad, provincia,
        tipo_cobertura, cobertura_medica, numero_afiliado, vigencia_credencial, plan_cobertura,
        grupo_sanguineo, factor_rh, alergias, medicacion_habitual,
        antecedentes_patologicos, antecedentes_familiares,
        contacto_emergencia_nombre, contacto_emergencia_vinculo, contacto_emergencia_telefono,
        motivo_ingreso, derivacion_destino
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, b.nombre, b.apellido, b.dni, b.cuil || null, b.fecha_nacimiento || null,
      b.genero || null, b.nacionalidad || null, b.telefono || null, b.email || null,
      b.domicilio || null, b.localidad || null, b.provincia || null,
      b.tipo_cobertura || null, coberturaMedica, b.numero_afiliado || null,
      b.vigencia_credencial || null, b.plan_cobertura || null,
      b.grupo_sanguineo || 'desconocido', b.factor_rh || 'desconocido',
      JSON.stringify(b.alergias || []), b.medicacion_habitual || null,
      b.antecedentes_patologicos || null, b.antecedentes_familiares || null,
      b.contacto_emergencia_nombre || null, b.contacto_emergencia_vinculo || null,
      b.contacto_emergencia_telefono || null, b.motivo_ingreso || null,
      b.derivacion_destino || null
    );

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'creacion',
      modulo: 'pacientes',
      descripcion: `Alta de paciente ${b.nombre} ${b.apellido} (DNI ${b.dni})`,
      pacienteId: id,
    });

    const row = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(id);
    res.status(201).json(hidratar(row));
  } catch (err) { next(err); }
});

router.put('/:id', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const b = req.body;
    const actual = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Paciente no encontrado' });

    if (b.dni && !/^\d+$/.test(b.dni)) {
      return res.status(400).json({ error: 'El DNI debe contener solo numeros' });
    }
    const coberturaMedica = b.tipo_cobertura === 'particular' ? null : (b.cobertura_medica ?? actual.cobertura_medica);

    await db.prepare(`
      UPDATE pacientes SET
        nombre=?, apellido=?, dni=?, cuil=?, fecha_nacimiento=?, genero=?, nacionalidad=?,
        telefono=?, email=?, domicilio=?, localidad=?, provincia=?,
        tipo_cobertura=?, cobertura_medica=?, numero_afiliado=?, vigencia_credencial=?, plan_cobertura=?,
        grupo_sanguineo=?, factor_rh=?, alergias=?, medicacion_habitual=?,
        antecedentes_patologicos=?, antecedentes_familiares=?,
        contacto_emergencia_nombre=?, contacto_emergencia_vinculo=?, contacto_emergencia_telefono=?,
        motivo_ingreso=?, derivacion_destino=?, actualizado_en=NOW()
      WHERE id = ?
    `).run(
      b.nombre ?? actual.nombre, b.apellido ?? actual.apellido, b.dni ?? actual.dni,
      b.cuil ?? actual.cuil, b.fecha_nacimiento ?? actual.fecha_nacimiento, b.genero ?? actual.genero,
      b.nacionalidad ?? actual.nacionalidad, b.telefono ?? actual.telefono, b.email ?? actual.email,
      b.domicilio ?? actual.domicilio, b.localidad ?? actual.localidad, b.provincia ?? actual.provincia,
      b.tipo_cobertura ?? actual.tipo_cobertura, coberturaMedica, b.numero_afiliado ?? actual.numero_afiliado,
      b.vigencia_credencial ?? actual.vigencia_credencial, b.plan_cobertura ?? actual.plan_cobertura,
      b.grupo_sanguineo ?? actual.grupo_sanguineo, b.factor_rh ?? actual.factor_rh,
      JSON.stringify(b.alergias ?? parseJsonSafe(actual.alergias, [])), b.medicacion_habitual ?? actual.medicacion_habitual,
      b.antecedentes_patologicos ?? actual.antecedentes_patologicos, b.antecedentes_familiares ?? actual.antecedentes_familiares,
      b.contacto_emergencia_nombre ?? actual.contacto_emergencia_nombre,
      b.contacto_emergencia_vinculo ?? actual.contacto_emergencia_vinculo,
      b.contacto_emergencia_telefono ?? actual.contacto_emergencia_telefono,
      b.motivo_ingreso ?? actual.motivo_ingreso, b.derivacion_destino ?? actual.derivacion_destino,
      req.params.id
    );

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'pacientes',
      descripcion: `Modificacion de datos de ${actual.nombre} ${actual.apellido}`,
      pacienteId: req.params.id,
    });

    const row = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(req.params.id);
    res.json(hidratar(row));
  } catch (err) { next(err); }
});

router.patch('/:id/baja', requireRol('administrador', 'recepcion'), async (req, res, next) => {
  try {
    const actual = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Paciente no encontrado' });

    await db.prepare(`UPDATE pacientes SET estado = 'inactivo', actualizado_en = NOW() WHERE id = ?`).run(req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'modificacion',
      modulo: 'pacientes',
      descripcion: `Baja logica de ${actual.nombre} ${actual.apellido}`,
      pacienteId: req.params.id,
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRol('administrador'), async (req, res, next) => {
  try {
    const actual = await db.prepare(`SELECT * FROM pacientes WHERE id = ?`).get(req.params.id);
    if (!actual) return res.status(404).json({ error: 'Paciente no encontrado' });

    await db.prepare(`DELETE FROM pacientes WHERE id = ?`).run(req.params.id);

    await registrarAuditoria({
      usuario: req.sesion.nombreCompleto,
      rol: req.sesion.rol,
      accion: 'eliminacion',
      modulo: 'pacientes',
      descripcion: `Eliminacion definitiva de ${actual.nombre} ${actual.apellido} (DNI ${actual.dni})`,
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

function hidratar(row) {
  return {
    ...row,
    alergias: parseJsonSafe(row.alergias, []),
  };
}

module.exports = router;

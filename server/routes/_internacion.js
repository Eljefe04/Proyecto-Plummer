// ------------------------------------------------------------
// Internacion automatica de pacientes.
//
// Lo usan las derivaciones, Guardia y (mas adelante) Quirofano.
// Antes cada uno creaba su registro de derivacion, mandaba la
// notificacion y ahi terminaba: el paciente nunca quedaba internado
// ni ocupaba una cama, asi que la pantalla de Internacion seguia
// vacia aunque la notificacion llegara.
// ------------------------------------------------------------

const db = require('../db/index');

const MINUTOS_LIMPIEZA = Number(process.env.MINUTOS_LIMPIEZA || 5);

// Que destinos de derivacion implican internar al paciente,
// y en que sector de camas cae cada uno.
const DESTINO_A_SECTOR = {
  internacion: 'internacion',
  terapia_intensiva: 'terapia_intensiva',
  guardia: 'guardia',
};

function requiereCama(destino) {
  return Object.prototype.hasOwnProperty.call(DESTINO_A_SECTOR, destino);
}

/**
 * Busca la primera cama disponible de un sector.
 *
 * Cuenta como disponible tanto la que esta libre como la que esta en
 * limpieza pero ya cumplio su tiempo: el estado de limpieza se deduce
 * de la hora (`limpieza_desde`), no de un temporizador en memoria, para
 * que sobreviva a los reinicios de Render.
 */
async function buscarCamaLibre(tx, sector) {
  return tx.prepare(`
    SELECT * FROM camas
    WHERE sector = ?
      AND paciente_id IS NULL
      AND (
        estado = 'libre'
        OR (estado = 'limpieza'
            AND limpieza_desde IS NOT NULL
            AND limpieza_desde < NOW() - (? * INTERVAL '1 minute'))
      )
    ORDER BY codigo
    LIMIT 1
  `).get(sector, MINUTOS_LIMPIEZA);
}

/**
 * Interna al paciente asignandole una cama del sector correspondiente.
 * Debe llamarse DENTRO de una transaccion: si algo falla, no puede
 * quedar una cama ocupada por alguien que figura ambulatorio.
 *
 * @returns {{ok: true, cama}|{ok: false, motivo: string}}
 */
async function internarPaciente(tx, { pacienteId, destino, medicoACargoId = null, altaEstimada = null }) {
  const sector = DESTINO_A_SECTOR[destino];
  if (!sector) return { ok: false, motivo: 'destino_sin_camas' };

  // Si ya tiene cama, no se le asigna otra: solo se asegura el estado.
  const camaActual = await tx.prepare('SELECT * FROM camas WHERE paciente_id = ?').get(pacienteId);
  if (camaActual) {
    await tx.prepare("UPDATE pacientes SET estado = 'internado' WHERE id = ?").run(pacienteId);
    return { ok: true, cama: camaActual, yaTenia: true };
  }

  const cama = await buscarCamaLibre(tx, sector);
  if (!cama) return { ok: false, motivo: 'sin_camas', sector };

  await tx.prepare(
    "UPDATE camas SET estado = 'ocupada', paciente_id = ?, limpieza_desde = NULL WHERE id = ?"
  ).run(pacienteId, cama.id);

  await tx.prepare(
    "UPDATE pacientes SET estado = 'internado', alta_estimada = ?, medico_a_cargo_id = ? WHERE id = ?"
  ).run(altaEstimada, medicoACargoId, pacienteId);

  return { ok: true, cama, yaTenia: false };
}

const NOMBRE_SECTOR = {
  internacion: 'Internación',
  terapia_intensiva: 'Terapia Intensiva',
  guardia: 'Guardia',
};

module.exports = {
  internarPaciente,
  buscarCamaLibre,
  requiereCama,
  DESTINO_A_SECTOR,
  NOMBRE_SECTOR,
  MINUTOS_LIMPIEZA,
};

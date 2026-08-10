const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// ------------------------------------------------------------
// Conexion a PostgreSQL (Neon en produccion, o cualquier Postgres
// local si se define DATABASE_URL para desarrollo).
// ------------------------------------------------------------
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('\n[db] ERROR: falta la variable de entorno DATABASE_URL.');
  console.error('[db] Definila en un archivo .env (desarrollo) o en las variables de entorno de Render (produccion).\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }, // requerido por Neon
});

// ------------------------------------------------------------
// Capa de compatibilidad: el resto del proyecto fue escrito usando
// la sintaxis db.prepare(sql).run(...) / .get(...) / .all(...) con
// placeholders '?' (estilo SQLite). Esta capa traduce esa sintaxis
// a consultas reales de Postgres (placeholders $1, $2, ...) sin que
// haya que reescribir cada ruta desde cero.
// ------------------------------------------------------------

function convertirPlaceholders(sqlTexto) {
  let i = 0;
  return sqlTexto.replace(/\?/g, () => `$${++i}`);
}

function prepare(sqlTexto) {
  const sqlConvertido = convertirPlaceholders(sqlTexto);

  return {
    async run(...params) {
      const res = await pool.query(sqlConvertido, params);
      return { changes: res.rowCount };
    },
    async get(...params) {
      const res = await pool.query(sqlConvertido, params);
      return res.rows[0];
    },
    async all(...params) {
      const res = await pool.query(sqlConvertido, params);
      return res.rows;
    },
  };
}

async function exec(sqlTexto) {
  await pool.query(sqlTexto);
}

// ------------------------------------------------------------
// Transacciones.
//
// Hace falta para los circuitos que tocan varias tablas a la vez:
// asignar una cama tiene que marcar la cama Y marcar al paciente
// como internado. Si una de las dos falla, no puede quedar la mitad
// hecha (una cama ocupada por un paciente que figura ambulatorio).
//
//   await db.transaccion(async (tx) => {
//     await tx.prepare('UPDATE ...').run(...);
//     await tx.prepare('UPDATE ...').run(...);
//   });
// ------------------------------------------------------------
async function transaccion(fn) {
  const client = await pool.connect();
  const tx = {
    prepare(sqlTexto) {
      const sqlConvertido = convertirPlaceholders(sqlTexto);
      return {
        async run(...params) {
          const res = await client.query(sqlConvertido, params);
          return { changes: res.rowCount };
        },
        async get(...params) {
          const res = await client.query(sqlConvertido, params);
          return res.rows[0];
        },
        async all(...params) {
          const res = await client.query(sqlConvertido, params);
          return res.rows;
        },
      };
    },
  };

  try {
    await client.query('BEGIN');
    const resultado = await fn(tx);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const db = { prepare, exec, transaccion, pool };

// ------------------------------------------------------------
// Inicializacion: crea las tablas si no existen (CREATE TABLE IF
// NOT EXISTS es seguro de repetir en cada arranque).
// ------------------------------------------------------------
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

db.listo = (async () => {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await pool.query(schema);
  console.log('[db] Conectado a PostgreSQL y esquema verificado.');
})();

module.exports = db;

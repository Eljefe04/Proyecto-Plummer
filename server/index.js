require('dotenv').config();

// Marcador de version: aparece en los logs de Render al arrancar.
// Sirve para saber de un vistazo QUE codigo esta corriendo realmente,
// sin tener que deducirlo de un numero de linea en un stack trace.
const VERSION_BUILD = '2026-08-13 · solicitud de cirugias';

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const db = require('./db/index');
const { obtenerSesion } = require('./middleware/auth');
const { initNotificaciones } = require('./sockets/notificaciones');

const authRoutes = require('./routes/auth');
const pacientesRoutes = require('./routes/pacientes');
const medicosRoutes = require('./routes/medicos');
const turnosRoutes = require('./routes/turnos');
const guardiaRoutes = require('./routes/guardia');
const recetasRoutes = require('./routes/recetas');
const derivacionesRoutes = require('./routes/derivaciones');
const laboratorioRoutes = require('./routes/laboratorio');
const imagenesRoutes = require('./routes/imagenes');
const farmaciaRoutes = require('./routes/farmacia');
const camasRoutes = require('./routes/camas');
const quirofanoRoutes = require('./routes/quirofano');
const enfermeriaRoutes = require('./routes/enfermeria');
const especialidadesRoutes = require('./routes/especialidades');
const notificacionesRoutes = require('./routes/notificaciones');
const auditoriaRoutes = require('./routes/auditoria');
const dashboardRoutes = require('./routes/dashboard');
const medicosHistoricosRoutes = require('./routes/medicos-historicos');
const evolucionesRoutes = require('./routes/evoluciones');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  // FLUIDEZ: por defecto socket.io arranca con HTTP long-polling y recien
  // despues intenta subir a WebSocket. Detras del proxy de Render esa subida
  // a veces no prospera y el sistema queda en polling, con varios segundos
  // de retraso en cada evento. Forzamos WebSocket directo.
  transports: ['websocket', 'polling'],
  pingInterval: 20000,
  pingTimeout: 25000,
});

app.use(cors());
app.use(express.json());

// ------------------------------------------------------------
// Rutas REST
// ------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/medicos', medicosRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/guardia', guardiaRoutes);
app.use('/api/recetas', recetasRoutes);
app.use('/api/derivaciones', derivacionesRoutes);
app.use('/api/laboratorio', laboratorioRoutes);
app.use('/api/imagenes', imagenesRoutes);
app.use('/api/farmacia', farmaciaRoutes);
app.use('/api/camas', camasRoutes);
app.use('/api/quirofano', quirofanoRoutes);
app.use('/api/enfermeria', enfermeriaRoutes);
app.use('/api/especialidades', especialidadesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/medicos-historicos', medicosHistoricosRoutes);
app.use('/api/evoluciones', evolucionesRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'Proyecto Plummer', hora: new Date().toISOString() });
});

// Ping liviano que NO toca la base: sirve para saber si el servicio de
// Render ya desperto, antes de intentar el login.
app.get('/api/ping', (req, res) => res.json({ ok: true, version: VERSION_BUILD, ts: Date.now() }));

// Despierta tambien a Neon (que se autosuspende en el plan gratuito)
// haciendo una consulta minima. El login lo llama antes de enviar
// credenciales, asi la espera se muestra explicada en pantalla.
app.get('/api/despertar', async (req, res) => {
  const t0 = Date.now();
  try {
    await db.prepare('SELECT 1 AS ok').get();
    res.json({ ok: true, base: 'despierta', ms: Date.now() - t0 });
  } catch (err) {
    res.status(503).json({ ok: false, base: 'durmiendo', detalle: err.message });
  }
});

// Middleware de manejo de errores centralizado: captura todo lo que
// las rutas pasan con next(err) y devuelve un JSON prolijo en vez de
// que Express devuelva HTML de error por defecto.
app.use((err, req, res, next) => {
  // Se registra el detalle completo en los logs de Render y se devuelve
  // el motivo al cliente. Antes solo llegaba "Error interno del servidor",
  // que no dejaba diagnosticar nada desde la pantalla.
  console.error('[error]', req.method, req.originalUrl, '->', err.message);
  if (err.stack) console.error(err.stack);

  // Errores de PostgreSQL traducidos a algo legible.
  const porCodigo = {
    '23505': 'Ya existe un registro con ese dato único (por ejemplo, un DNI repetido).',
    '23503': 'El registro hace referencia a algo que no existe.',
    '23502': 'Falta completar un campo obligatorio.',
    '23514': 'Un valor no está permitido para ese campo.',
    '42703': 'La base de datos no tiene una columna que el sistema esperaba. Puede faltar aplicar una migración.',
  };

  res.status(err.status || 500).json({
    error: porCodigo[err.code] || err.message || 'Error interno del servidor',
    codigo: err.code || null,
    detalle: err.detail || null,
  });
});

// ------------------------------------------------------------
// Socket.IO: cada cliente se une a "salas" segun su rol y,
// si es medico, tambien a una sala especifica por medicoId.
// Esto es lo que permite el aislamiento de datos Y la
// sincronizacion en tiempo real entre terminales.
// ------------------------------------------------------------
io.on('connection', (socket) => {
  socket.on('identificarse', async (token) => {
    const sesion = await obtenerSesion(token);
    if (!sesion) {
      socket.emit('sesion_invalida');
      return;
    }

    socket.join(`rol:${sesion.rol}`);
    if (sesion.medicoId) {
      socket.join(`medico:${sesion.medicoId}`);
    }
    // Sala general de administrador/recepcion para refrescos de dashboard
    if (sesion.rol === 'administrador') {
      socket.join('rol:administrador');
    }

    socket.data.sesion = sesion;
  });

  socket.on('disconnect', () => {
    // no hace falta limpiar salas manualmente, socket.io lo hace solo
  });
});

initNotificaciones(io);

const PORT = process.env.PORT || 3001;

// La conexion a PostgreSQL y la verificacion del esquema son asincronas.
// Esperamos a que terminen antes de aceptar conexiones HTTP.
db.listo.then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[Proyecto Plummer] Servidor corriendo en:`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  Red:     http://<TU-IP-LOCAL>:${PORT}  (usar esta IP en las otras PCs)\n`);
  });
}).catch((err) => {
  console.error('[db] No se pudo conectar a la base de datos:', err.message);
  process.exit(1);
});

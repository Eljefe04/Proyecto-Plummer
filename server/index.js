require('dotenv').config();

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

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' }, // red local del colegio: se permite cualquier origen
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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, servicio: 'Proyecto Plummer', hora: new Date().toISOString() });
});

// Middleware de manejo de errores centralizado: captura todo lo que
// las rutas pasan con next(err) y devuelve un JSON prolijo en vez de
// que Express devuelva HTML de error por defecto.
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno del servidor', detalle: err.message });
});

// ------------------------------------------------------------
// Socket.IO: cada cliente se une a "salas" segun su rol y,
// si es medico, tambien a una sala especifica por medicoId.
// Esto es lo que permite el aislamiento de datos Y la
// sincronizacion en tiempo real entre terminales.
// ------------------------------------------------------------
io.on('connection', (socket) => {
  socket.on('identificarse', (token) => {
    const sesion = obtenerSesion(token);
    if (!sesion) return;

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

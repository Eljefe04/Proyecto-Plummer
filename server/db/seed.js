require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const db = require('./index');

async function main() {
  // db.listo espera a que la conexion a Postgres este lista y el
  // esquema verificado, antes de tocar cualquier tabla.
  await db.listo;

  console.log('[seed] Limpiando datos existentes...');

  const tablas = [
    'notificaciones', 'auditoria', 'dispensaciones', 'medicamentos',
    'enfermeria_registros', 'fichas_anestesicas', 'cirugias', 'camas',
    'guardia_ingresos', 'estudios_imagenes', 'estudios_laboratorio',
    'derivaciones', 'recetas', 'evoluciones', 'turnos',
    'pediatria_percentiles', 'pediatria_vacunas', 'neurologia_seguimientos',
    'cardiologia_ecg', 'cardiologia_marcapasos', 'obstetricia_ecografias',
    'obstetricia_controles', 'pacientes', 'usuarios', 'medicos',
  ];
  for (const t of tablas) {
    await db.prepare(`DELETE FROM ${t}`).run();
  }

  console.log('[seed] Creando usuarios con credenciales genericas por rol...');

  const usuariosGenericos = [
    { usuario: 'admin', password: 'admin', rol: 'administrador', nombre: 'Administrador del Sistema' },
    { usuario: 'recepcion', password: 'recepcion', rol: 'recepcion', nombre: 'Recepción' },
    { usuario: 'enfermeria', password: 'enfermeria', rol: 'enfermeria', nombre: 'Enfermería' },
    { usuario: 'farmacia', password: 'farmacia', rol: 'farmacia', nombre: 'Farmacia' },
    { usuario: 'laboratorio', password: 'laboratorio', rol: 'laboratorio', nombre: 'Laboratorio' },
    { usuario: 'imagenes', password: 'imagenes', rol: 'imagenes', nombre: 'Imágenes' },
    { usuario: 'quirofano', password: 'quirofano', rol: 'quirofano', nombre: 'Quirófano' },
  ];

  for (const u of usuariosGenericos) {
    await db.prepare(`
      INSERT INTO usuarios (id, usuario, password, rol, nombre_completo)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), u.usuario, u.password, u.rol, u.nombre);
  }

  console.log('[seed] Creando médicos de ejemplo con agenda configurada...');

  const medicos = [
    {
      nombre: 'Juan', apellido: 'Perez', matricula: 'MP-11111', especialidad: 'cardiologia',
      consultorio: 'Consultorio 2', hora_inicio: '08:00', hora_fin: '13:00',
      duracion_turno_min: 20, dias_atencion: ['lunes', 'miercoles', 'viernes'],
    },
    {
      nombre: 'Carlos', apellido: 'Lopez', matricula: 'MP-22222', especialidad: 'neurologia',
      consultorio: 'Consultorio 3', hora_inicio: '10:00', hora_fin: '15:00',
      duracion_turno_min: 30, dias_atencion: ['martes', 'jueves'],
    },
    {
      nombre: 'Jorge Martin', apellido: 'Fernandez', matricula: 'MP-33333', especialidad: 'pediatria',
      consultorio: 'Consultorio 4', hora_inicio: '09:00', hora_fin: '14:00',
      duracion_turno_min: 20, dias_atencion: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'],
    },
    {
      nombre: 'Maria', apellido: 'Gonzalez', matricula: 'MP-44444', especialidad: 'obstetricia',
      consultorio: 'Consultorio 1', hora_inicio: '08:00', hora_fin: '12:00',
      duracion_turno_min: 30, dias_atencion: ['lunes', 'miercoles', 'viernes'],
    },
  ];

  for (const m of medicos) {
    const id = uuidv4();
    await db.prepare(`
      INSERT INTO medicos (id, nombre, apellido, matricula, especialidad, consultorio, hora_inicio, hora_fin, duracion_turno_min, dias_atencion)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(id, m.nombre, m.apellido, m.matricula, m.especialidad, m.consultorio, m.hora_inicio, m.hora_fin, m.duracion_turno_min, JSON.stringify(m.dias_atencion));

    const credencial = `${m.nombre} ${m.apellido}`;
    await db.prepare(`
      INSERT INTO usuarios (id, usuario, password, rol, nombre_completo, medico_id)
      VALUES (?, ?, ?, 'medico', ?, ?)
    `).run(uuidv4(), credencial, credencial, credencial, id);
  }

  console.log('[seed] Creando camas...');

  const camas = [
    ...['I-101', 'I-102', 'I-103', 'I-104', 'I-105', 'I-106'].map((c) => ({ codigo: c, sector: 'internacion' })),
    ...['UTI-1', 'UTI-2', 'UTI-3', 'UTI-4'].map((c) => ({ codigo: c, sector: 'terapia_intensiva' })),
    ...['G-1', 'G-2', 'G-3'].map((c) => ({ codigo: c, sector: 'guardia' })),
    ...['Q-A', 'Q-B'].map((c) => ({ codigo: c, sector: 'quirofano' })),
    ...['R-1', 'R-2'].map((c) => ({ codigo: c, sector: 'recuperacion' })),
  ];

  for (const c of camas) {
    await db.prepare(`INSERT INTO camas (id, codigo, sector) VALUES (?, ?, ?)`).run(uuidv4(), c.codigo, c.sector);
  }

  console.log('[seed] Creando inventario de farmacia...');

  const medicamentos = [
    { nombre: 'Paracetamol 500mg', categoria: 'Analgesico', vencimiento: '2027-06-30', stock: 500, stock_minimo: 100 },
    { nombre: 'Ibuprofeno 400mg', categoria: 'Antiinflamatorio', vencimiento: '2027-03-30', stock: 300, stock_minimo: 100 },
    { nombre: 'Amoxicilina 500mg', categoria: 'Antibiotico', vencimiento: '2027-08-14', stock: 200, stock_minimo: 50 },
    { nombre: 'Losartan 50mg', categoria: 'Antihipertensivo', vencimiento: '2027-10-30', stock: 150, stock_minimo: 40 },
    { nombre: 'Omeprazol 20mg', categoria: 'Otros', vencimiento: '2027-11-29', stock: 299, stock_minimo: 60 },
    { nombre: 'Dipirona 1g', categoria: 'Analgesico', vencimiento: '2027-07-30', stock: 250, stock_minimo: 60 },
  ];

  for (const m of medicamentos) {
    await db.prepare(`
      INSERT INTO medicamentos (id, nombre, categoria, vencimiento, stock, stock_minimo)
      VALUES (?,?,?,?,?,?)
    `).run(uuidv4(), m.nombre, m.categoria, m.vencimiento, m.stock, m.stock_minimo);
  }

  console.log('\n[seed] Listo. Credenciales de acceso:\n');
  console.log('  Administrador:   admin / admin');
  console.log('  Recepcion:       recepcion / recepcion');
  console.log('  Enfermeria:      enfermeria / enfermeria');
  console.log('  Farmacia:        farmacia / farmacia');
  console.log('  Laboratorio:     laboratorio / laboratorio');
  console.log('  Imagenes:        imagenes / imagenes');
  console.log('  Quirofano:       quirofano / quirofano');
  console.log('  Medicos (usuario y contraseña = nombre y apellido):');
  medicos.forEach((m) => console.log(`    ${m.especialidad}: ${m.nombre} ${m.apellido}`));
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});

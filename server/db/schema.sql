-- ============================================================
-- PROYECTO PLUMMER - Mayo Clinic Buenos Aires
-- Esquema de base de datos PostgreSQL (Neon)
-- ============================================================

-- ------------------------------------------------------------
-- MEDICOS (va primero: usuarios lo referencia)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT,
  matricula TEXT NOT NULL,
  especialidad TEXT NOT NULL CHECK (especialidad IN (
    'obstetricia','cardiologia','neurologia','pediatria'
  )),
  consultorio TEXT,
  telefono TEXT,
  email TEXT,
  hora_inicio TEXT,
  hora_fin TEXT,
  duracion_turno_min INTEGER DEFAULT 30,
  dias_atencion TEXT,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- USUARIOS (login por rol)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  usuario TEXT NOT NULL,
  password TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN (
    'administrador','recepcion','enfermeria','farmacia',
    'laboratorio','imagenes','quirofano','medico'
  )),
  nombre_completo TEXT NOT NULL,
  medico_id TEXT REFERENCES medicos(id) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- PACIENTES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pacientes (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT NOT NULL UNIQUE,
  cuil TEXT,
  fecha_nacimiento TEXT,
  genero TEXT CHECK (genero IN ('masculino','femenino','otro') OR genero IS NULL),
  nacionalidad TEXT,
  telefono TEXT,
  email TEXT,
  domicilio TEXT,
  localidad TEXT,
  provincia TEXT,
  tipo_cobertura TEXT CHECK (tipo_cobertura IN ('obra_social','prepaga','particular') OR tipo_cobertura IS NULL),
  cobertura_medica TEXT,
  numero_afiliado TEXT,
  vigencia_credencial TEXT,
  plan_cobertura TEXT,
  grupo_sanguineo TEXT DEFAULT 'desconocido',
  factor_rh TEXT DEFAULT 'desconocido',
  alergias TEXT,
  medicacion_habitual TEXT,
  antecedentes_patologicos TEXT,
  antecedentes_familiares TEXT,
  contacto_emergencia_nombre TEXT,
  contacto_emergencia_vinculo TEXT,
  contacto_emergencia_telefono TEXT,
  motivo_ingreso TEXT,
  derivacion_destino TEXT,
  estado TEXT NOT NULL DEFAULT 'ambulatorio' CHECK (estado IN ('ambulatorio','internado','inactivo')),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TURNOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turnos (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  medico_id TEXT NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL,
  modalidad TEXT NOT NULL DEFAULT 'presencial' CHECK (modalidad IN ('presencial','telemedicina')),
  consultorio TEXT,
  motivo_consulta TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','atendido','cancelado')),
  creado_por TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- EVOLUCIONES CLINICAS (HCE)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evoluciones (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  medico_id TEXT NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  fecha_hora TIMESTAMP NOT NULL DEFAULT NOW(),
  texto TEXT NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- RECETAS DIGITALES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recetas (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  medico_id TEXT NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  medicamento TEXT NOT NULL,
  dosis TEXT,
  via_administracion TEXT,
  frecuencia TEXT,
  duracion_tratamiento TEXT,
  indicaciones TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','dispensada')),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- DERIVACIONES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS derivaciones (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  origen TEXT NOT NULL,
  destino TEXT NOT NULL,
  motivo TEXT,
  derivado_por TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','recibida')),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ESTUDIOS DE LABORATORIO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estudios_laboratorio (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  solicitado_por TEXT NOT NULL,
  solicitado_por_medico_id TEXT REFERENCES medicos(id) ON DELETE SET NULL,
  estudios TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('normal','urgente')),
  indicaciones TEXT,
  resultado TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','realizado')),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
  completado_en TIMESTAMP
);

-- ------------------------------------------------------------
-- ESTUDIOS DE IMAGENES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estudios_imagenes (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  solicitado_por TEXT NOT NULL,
  solicitado_por_medico_id TEXT REFERENCES medicos(id) ON DELETE SET NULL,
  tipo_estudio TEXT NOT NULL,
  region TEXT,
  prioridad TEXT NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('normal','urgente')),
  informe TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','realizado','entregado')),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
  completado_en TIMESTAMP
);

-- ------------------------------------------------------------
-- GUARDIA / URGENCIAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guardia_ingresos (
  id TEXT PRIMARY KEY,
  paciente_id TEXT REFERENCES pacientes(id) ON DELETE SET NULL,
  protocolo_nn BOOLEAN NOT NULL DEFAULT FALSE,
  nombre_temporal TEXT,
  medio_transporte TEXT,
  acompanante_nombre TEXT,
  acompanante_vinculo TEXT,
  nivel_triage INTEGER NOT NULL CHECK (nivel_triage BETWEEN 1 AND 5),
  motivo_consulta TEXT NOT NULL,
  signos_vitales TEXT,
  observaciones TEXT,
  tags TEXT,
  cama_id TEXT,
  derivacion_destino TEXT,
  estado TEXT NOT NULL DEFAULT 'en_espera' CHECK (estado IN ('en_espera','en_atencion','derivado','alta')),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- CAMAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS camas (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  sector TEXT NOT NULL CHECK (sector IN ('internacion','terapia_intensiva','guardia','quirofano','recuperacion')),
  estado TEXT NOT NULL DEFAULT 'libre' CHECK (estado IN ('libre','ocupada','limpieza')),
  paciente_id TEXT REFERENCES pacientes(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- CIRUGIAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cirugias (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo_cirugia TEXT NOT NULL,
  caracter TEXT NOT NULL DEFAULT 'programada' CHECK (caracter IN ('programada','urgente')),
  tipo_intervencion TEXT NOT NULL DEFAULT 'ambulatoria' CHECK (tipo_intervencion IN ('ambulatoria','internacion')),
  cirujano_id TEXT REFERENCES medicos(id) ON DELETE SET NULL,
  anestesiologo TEXT,
  quirofano TEXT,
  fecha_programada TEXT,
  hora_inicio TEXT,
  duracion_estimada TEXT,
  equipo_quirurgico TEXT,
  notas_prequirurgicas TEXT,
  cama_reservada_id TEXT,
  solicitado_por_medico_id TEXT REFERENCES medicos(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada','en_curso','finalizada','cancelada')),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- FICHAS ANESTESICAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fichas_anestesicas (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  cirugia_id TEXT REFERENCES cirugias(id) ON DELETE SET NULL,
  tipo_anestesia TEXT NOT NULL DEFAULT 'general',
  clasificacion_asa TEXT NOT NULL DEFAULT 'ASA I',
  evaluacion_preanestesica TEXT,
  drogas_fluidos TEXT,
  recuperacion_signos_vitales TEXT,
  recuperacion_tiempo TEXT,
  recuperacion_estado_alta TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- FARMACIA - INVENTARIO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicamentos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT,
  vencimiento TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 20,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- FARMACIA - DISPENSACIONES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispensaciones (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  medicamento_id TEXT NOT NULL REFERENCES medicamentos(id) ON DELETE CASCADE,
  receta_id TEXT REFERENCES recetas(id) ON DELETE SET NULL,
  cantidad INTEGER NOT NULL,
  indicaciones TEXT,
  dispensado_por TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ENFERMERIA - SIGNOS VITALES / NOTAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enfermeria_registros (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('signos_vitales','medicacion_administrada','nota_evolucion')),
  detalle TEXT NOT NULL,
  registrado_por TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- MODULOS ESPECIFICOS POR ESPECIALIDAD
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS obstetricia_controles (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  fum TEXT,
  peso_kg REAL,
  semana_gestacion INTEGER,
  fecha_control TIMESTAMP NOT NULL DEFAULT NOW(),
  observaciones TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS obstetricia_ecografias (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  semana_gestacion INTEGER,
  observaciones TEXT,
  archivo_nombre TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cardiologia_marcapasos (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  modelo TEXT,
  fecha_implante TEXT,
  parametros TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cardiologia_ecg (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  observaciones TEXT,
  archivo_nombre TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS neurologia_seguimientos (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  sintomas TEXT,
  escala_progresion TEXT,
  observaciones TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pediatria_vacunas (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  vacuna TEXT NOT NULL,
  fecha_aplicacion TEXT,
  proxima_dosis TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aplicada')),
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pediatria_percentiles (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  fecha TIMESTAMP NOT NULL DEFAULT NOW(),
  peso_kg REAL,
  talla_cm REAL,
  perimetro_cefalico_cm REAL,
  edad_meses INTEGER,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- AUDITORIA (Ley 26.529)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id TEXT PRIMARY KEY,
  usuario TEXT NOT NULL,
  rol TEXT,
  accion TEXT NOT NULL CHECK (accion IN ('creacion','modificacion','eliminacion','acceso_hce','login')),
  modulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  paciente_id TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- NOTIFICACIONES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
  id TEXT PRIMARY KEY,
  destino_rol TEXT NOT NULL,
  destino_medico_id TEXT,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  paciente_id TEXT,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Indices utiles
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_turnos_medico ON turnos(medico_id);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);
CREATE INDEX IF NOT EXISTS idx_pacientes_dni ON pacientes(dni);
CREATE INDEX IF NOT EXISTS idx_recetas_paciente ON recetas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_estudios_lab_estado ON estudios_laboratorio(estado);
CREATE INDEX IF NOT EXISTS idx_estudios_img_estado ON estudios_imagenes(estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_rol ON notificaciones(destino_rol, leida);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(creado_en);


-- ============================================================
-- MIGRACIONES v2
-- ------------------------------------------------------------
-- Todo lo de abajo es idempotente: se puede ejecutar en cada
-- arranque sin romper nada. Por eso el sistema se actualiza solo
-- al redeployar, sin tener que entrar a la consola de Neon.
-- ============================================================

-- ---------- 1. TABLAS NUEVAS ----------

-- Sesiones persistentes. Antes vivian en un Map() en memoria del
-- servidor: cuando Render dormia el servicio o se redeployaba, se
-- perdian todas y los usuarios quedaban trabados.
CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  usuario TEXT NOT NULL,
  rol TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  medico_id TEXT,
  especialidad TEXT,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sesiones_actividad ON sesiones(ultima_actividad);

-- Resultados de laboratorio estructurados (analito / valor / rango),
-- en vez de un unico campo de texto libre.
CREATE TABLE IF NOT EXISTS laboratorio_resultados (
  id TEXT PRIMARY KEY,
  estudio_id TEXT NOT NULL REFERENCES estudios_laboratorio(id) ON DELETE CASCADE,
  analito TEXT NOT NULL,
  valor TEXT NOT NULL,
  unidad TEXT,
  ref_min NUMERIC,
  ref_max NUMERIC,
  orden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lab_resultados_estudio ON laboratorio_resultados(estudio_id);

-- ---------- 2. COLUMNAS NUEVAS ----------

ALTER TABLE turnos      ADD COLUMN IF NOT EXISTS codigo_videollamada TEXT;
ALTER TABLE camas       ADD COLUMN IF NOT EXISTS limpieza_desde TIMESTAMPTZ;
ALTER TABLE pacientes   ADD COLUMN IF NOT EXISTS alta_estimada DATE;
ALTER TABLE pacientes   ADD COLUMN IF NOT EXISTS medico_a_cargo_id TEXT;

ALTER TABLE recetas     ADD COLUMN IF NOT EXISTS medicamento_id TEXT;

ALTER TABLE derivaciones ADD COLUMN IF NOT EXISTS prioridad TEXT NOT NULL DEFAULT 'normal';

ALTER TABLE estudios_laboratorio ADD COLUMN IF NOT EXISTS origen_modulo TEXT;
ALTER TABLE estudios_imagenes    ADD COLUMN IF NOT EXISTS origen_modulo TEXT;
ALTER TABLE estudios_imagenes    ADD COLUMN IF NOT EXISTS indicaciones TEXT;
ALTER TABLE estudios_imagenes    ADD COLUMN IF NOT EXISTS imagen_datos TEXT;

ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS anestesiologo_id TEXT;
ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS complejidad TEXT NOT NULL DEFAULT 'media';
ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS dias_internacion_estimados INTEGER;
ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS parte_quirurgico TEXT;
ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS checklist_oms TEXT;
ALTER TABLE cirugias ADD COLUMN IF NOT EXISTS cama_asignada_id TEXT;

-- ---------- 3. RESTRICCIONES REESCRITAS ----------
-- Estas son las unicas que modifican algo que ya existia.

-- Cirujanos y anestesiologos como especialidades validas.
ALTER TABLE medicos DROP CONSTRAINT IF EXISTS medicos_especialidad_check;
ALTER TABLE medicos ADD CONSTRAINT medicos_especialidad_check
  CHECK (especialidad IN ('obstetricia','cardiologia','neurologia','pediatria','cirugia','anestesiologia'));

-- Estado 'solicitada': la cirugia que pidio un medico y que Quirofano
-- todavia no programo.
ALTER TABLE cirugias DROP CONSTRAINT IF EXISTS cirugias_estado_check;
ALTER TABLE cirugias ADD CONSTRAINT cirugias_estado_check
  CHECK (estado IN ('solicitada','programada','en_curso','finalizada','cancelada'));

-- Estados intermedios en laboratorio e imagenes.
ALTER TABLE estudios_laboratorio DROP CONSTRAINT IF EXISTS estudios_laboratorio_estado_check;
ALTER TABLE estudios_laboratorio ADD CONSTRAINT estudios_laboratorio_estado_check
  CHECK (estado IN ('pendiente','muestra_tomada','en_proceso','realizado'));

ALTER TABLE estudios_imagenes DROP CONSTRAINT IF EXISTS estudios_imagenes_estado_check;
ALTER TABLE estudios_imagenes ADD CONSTRAINT estudios_imagenes_estado_check
  CHECK (estado IN ('pendiente','en_sala','realizado','informado','entregado'));

-- ---------- 4. INDICES DE APOYO ----------
CREATE INDEX IF NOT EXISTS idx_turnos_medico_fecha  ON turnos(medico_id, fecha);
CREATE INDEX IF NOT EXISTS idx_camas_estado         ON camas(estado);
CREATE INDEX IF NOT EXISTS idx_recetas_estado       ON recetas(estado);
CREATE INDEX IF NOT EXISTS idx_derivaciones_destino ON derivaciones(destino, estado);
CREATE INDEX IF NOT EXISTS idx_cirugias_estado      ON cirugias(estado);

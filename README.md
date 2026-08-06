# Proyecto Plummer — Mayo Clinic Buenos Aires

Sistema Integral de Administración Hospitalaria. Proyecto académico —
Ingeniería en Sistemas de Información, E.E.T N°18.

Homenaje al Dr. Henry Plummer, pionero de la Historia Clínica Unificada
por paciente.

---

## 1. Requisitos

- [Node.js](https://nodejs.org) versión 18 o superior instalado en la PC
  que va a hacer de **servidor**.
- Visual Studio Code (o cualquier editor).
- Todas las PCs (servidor y clientes) conectadas a la **misma red Wi-Fi
  o cable** (por ejemplo, la red del colegio).

No hace falta instalar SQL por separado, ni herramientas de compilación
de C++/Visual Studio: la base de datos es **PostgreSQL alojado en
Neon** (gratis), a la que el servidor se conecta por internet. Solo
necesitás crear una cuenta gratuita en Neon (ver sección 2.1) y pegar
la cadena de conexión en un archivo `.env`.

---

## 2. Crear la base de datos gratuita en Neon

1. Entrá a [neon.com](https://neon.com) y creá una cuenta gratuita
   (con GitHub, Google, o email).
2. Creá un proyecto nuevo — ponele el nombre que quieras, por ejemplo
   `proyecto-plummer`.
3. En el panel del proyecto, copiá el **Connection string** (empieza
   con `postgresql://...`). Lo vas a necesitar en el paso siguiente.

---

## 3. Instalación (una sola vez, en la PC servidor)

Abrí una terminal en la carpeta del proyecto y ejecutá:

```bash
# Instala las dependencias del servidor
cd server
npm install

# Instala las dependencias del cliente
cd ../client
npm install
```

### Configurar la conexión a la base de datos

Dentro de la carpeta `server`, copiá el archivo `.env.example` y
renombrá la copia a `.env`. Abrilo con un editor de texto y reemplazá
la línea `DATABASE_URL=...` por la cadena de conexión real que
copiaste de Neon en el paso 2.

```
DATABASE_URL=postgresql://usuario:password@host/basededatos?sslmode=require
```

> El archivo `.env` nunca se comparte ni se sube a ningún repositorio
> — contiene la contraseña de tu base de datos.

---

## 4. Cargar los datos iniciales (seed)

Esto crea las tablas y los usuarios/médicos/camas/medicamentos de
ejemplo, con las credenciales genéricas:

```bash
cd server
npm run seed
```

Vas a ver en la consola el listado de usuarios y contraseñas creados.
Podés correr este comando de nuevo cuando quieras **resetear** todos
los datos a un estado limpio (por ejemplo, antes de una demostración) —
borra todo lo cargado y vuelve a dejar los datos de ejemplo.

---

## 5. Levantar el sistema

Necesitás **dos terminales abiertas al mismo tiempo** (podés usar dos
pestañas de terminal en VS Code):

**Terminal 1 — Backend (API + base de datos + tiempo real):**
```bash
cd server
npm run dev
```
Vas a ver un mensaje con la IP local del servidor, algo así:
```
[Proyecto Plummer] Servidor corriendo en:
  Local:   http://localhost:3001
  Red:     http://<TU-IP-LOCAL>:3001
```

**Terminal 2 — Frontend (la interfaz que se ve):**
```bash
cd client
npm run dev
```
Esto va a mostrar algo como:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

Abrí `http://localhost:5173` en el navegador de la PC servidor. Ya
deberías ver la pantalla de Login.

---

## 6. Conectar las otras PCs de la red (para cumplir "3 o más terminales")

1. En la PC servidor, fijate cuál es tu **IP de red local**. El mismo
   mensaje del backend (`Red: http://<TU-IP-LOCAL>:3001`) te la muestra,
   o podés correr:
   - Windows: `ipconfig` (buscá "Dirección IPv4")
   - Mac/Linux: `ifconfig` o `ip addr`

2. En **cada una de las otras PCs** (conectadas a la misma red), abrí un
   navegador y entrá a:
   ```
   http://<IP-DE-LA-PC-SERVIDOR>:5173
   ```
   Por ejemplo: `http://192.168.1.15:5173`

3. Cada PC puede loguearse con un rol distinto (Recepción en una,
   Cardiología en otra, Farmacia en otra) y vas a ver que las
   notificaciones y actualizaciones aparecen **en tiempo real** en todas
   las pantallas conectadas, sin recargar la página.

> Importante: dejá las dos terminales (backend y frontend) abiertas
> mientras uses el sistema. Si cerrás la terminal, el servidor se apaga
> y las demás PCs pierden la conexión.

---

## 6. Credenciales de acceso

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin` | `admin` |
| Recepción / Admisión | `recepcion` | `recepcion` |
| Enfermería | `enfermeria` | `enfermeria` |
| Farmacia | `farmacia` | `farmacia` |
| Laboratorio | `laboratorio` | `laboratorio` |
| Imágenes | `imagenes` | `imagenes` |
| Quirófano (Cirugía y Anestesiología) | `quirofano` | `quirofano` |

**Médicos** (usuario y contraseña = nombre y apellido, elegir la
especialidad primero en el login):

| Especialidad | Médico |
|---|---|
| Cardiología | Juan Perez |
| Neurología | Carlos Lopez |
| Pediatría | Jorge Martin Fernandez |
| Obstetricia | Maria Gonzalez |

---

## 7. Estructura del proyecto

```
proyecto-plummer/
├── server/               → Backend: Node.js + Express + PostgreSQL + Socket.IO
│   ├── db/
│   │   ├── schema.sql    → Definición de todas las tablas
│   │   ├── seed.js       → Datos iniciales de ejemplo
│   │   └── index.js      → Conexión a la base de datos (Neon)
│   ├── routes/           → Endpoints de la API (uno por módulo)
│   ├── sockets/          → Notificaciones en tiempo real
│   ├── middleware/       → Autenticación por rol
│   ├── .env.example      → Plantilla de configuración (copiar a .env)
│   └── index.js          → Punto de entrada del servidor
│
└── client/               → Frontend: React + Vite
    └── src/
        ├── pages/         → Una carpeta/archivo por cada módulo
        │   ├── recepcion/     (Pacientes, Turnos, Guardia, Médicos)
        │   ├── terminal/      (Módulos de las 4 especialidades)
        │   ├── enfermeria/
        │   ├── administrador/
        │   └── quirofano/
        ├── components/    → Piezas reutilizables (Modal, botones, etc.)
        └── context/       → Sesión de usuario y conexión en tiempo real
```

---

## 8. Notas para la defensa del proyecto

- **Base de datos:** PostgreSQL alojado en Neon (gratuito, con 25
  tablas cubriendo pacientes, turnos, médicos, guardia, camas,
  cirugías, fichas anestésicas, farmacia, laboratorio, imágenes, y los
  módulos específicos de cada especialidad (control prenatal,
  marcapasos, ECG, seguimiento neurológico, vacunas, percentiles). A
  diferencia de una base de datos local en el disco del servidor,
  Neon persiste los datos aunque el servidor se reinicie o se
  redespliegue.
- **Tiempo real:** implementado con WebSockets (Socket.IO). Cada rol se
  conecta a una "sala" propia; cuando una acción en una terminal afecta
  a otra (por ejemplo, Recepción crea un turno), el servidor avisa
  automáticamente a la terminal correspondiente sin necesidad de
  recargar la página — esto es lo que la versión anterior (hecha en
  Base44) no lograba resolver.
- **Auditoría:** Ley 26.529, con registro real de cada creación,
  modificación, eliminación y acceso a Historia Clínica Electrónica.
- **Seguridad del login:** el selector de especialidad médica no expone
  los nombres de los médicos registrados (a diferencia de la versión
  anterior), y cada médico solo puede loguearse dentro de su propia
  especialidad.

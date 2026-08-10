import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, despertarServidor } from '../api';
import LogoPlummer from '../components/LogoPlummer';
import HistoricoMedico from '../components/HistoricoMedico';
import './Login.css';

const ROLES = [
  { valor: 'administrador', label: 'Administrador', desc: 'Acceso total al sistema', icono: 'escudo' },
  { valor: 'recepcion', label: 'Recepción / Admisión', desc: 'Pacientes, turnos, guardia', icono: 'portapapeles' },
  { valor: 'medico', label: 'Médico', desc: 'Terminal especializada', icono: 'estetoscopio' },
  { valor: 'enfermeria', label: 'Enfermería', desc: 'Internación y camas', icono: 'corazon' },
  { valor: 'farmacia', label: 'Farmacia', desc: 'Stock y dispensación', icono: 'pastilla' },
  { valor: 'laboratorio', label: 'Laboratorio', desc: 'Estudios y resultados', icono: 'matraz' },
  { valor: 'imagenes', label: 'Imágenes', desc: 'Radiografía y estudios', icono: 'escaner' },
  { valor: 'quirofano', label: 'Quirófano', desc: 'Cirugía y anestesiología', icono: 'bisturi' },
];

const ICONOS = {
  escudo: (
    <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
  ),
  portapapeles: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M9 11h6M9 15h6" />
    </>
  ),
  estetoscopio: (
    <path d="M6 3v6a4 4 0 0 0 8 0V3M10 17a4 4 0 1 0 8 0v-2M14 15V9M18 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
  ),
  corazon: (
    <path d="M12 20s-7-4.4-9.3-8.8C1.2 8.1 3 5 6.2 5c1.8 0 3.2 1 3.8 2.4C10.6 6 12 5 13.8 5 17 5 18.8 8.1 21.3 11.2 19 15.6 12 20 12 20Z" />
  ),
  pastilla: (
    <path d="M4.6 12.6 12.6 4.6a4.2 4.2 0 1 1 6 6l-8 8a4.2 4.2 0 0 1-6-6ZM9 8l7 7" />
  ),
  matraz: (
    <path d="M10 2h4M11 2v6l-5.5 9.5A2 2 0 0 0 7.2 21h9.6a2 2 0 0 0 1.7-3.5L13 8V2M8 15h8" />
  ),
  escaner: (
    <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3M3 12h18" />
  ),
  bisturi: (
    <path d="M3 21 12 12M12 12l7-7a2.1 2.1 0 0 1 3 3l-7 7M12 12 9 9" />
  ),
};

function Icono({ tipo }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {ICONOS[tipo]}
    </svg>
  );
}

export default function Login() {
  const { login, avisoSesion, limpiarAviso } = useAuth();
  const navigate = useNavigate();

  const [rolSeleccionado, setRolSeleccionado] = useState('administrador');
  const [especialidades, setEspecialidades] = useState([]);
  const [especialidad, setEspecialidad] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [plummer, setPlummer] = useState(null);

  // Estado del servidor: en Render gratuito el servicio se duerme a los
  // ~15 min y tarda cerca de 50 s en despertar (y Neon otro tanto). Sin
  // avisar, el boton de ingresar parecia colgado y la web rota.
  const [servidor, setServidor] = useState({ estado: 'conectando', intento: 1, total: 12 });

  useEffect(() => {
    let vivo = true;
    despertarServidor((p) => vivo && setServidor(p)).then((ok) => {
      if (!vivo || !ok) return;
      api.get('/auth/especialidades').then(setEspecialidades).catch(() => {});
      api.get('/medicos-historicos/plummer').then(setPlummer).catch(() => {});
    });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (rolSeleccionado === 'medico' && !especialidad && especialidades.length) {
      setEspecialidad(especialidades[0].valor);
    }
  }, [rolSeleccionado, especialidades, especialidad]);

  async function manejarEnvio(e) {
    e.preventDefault();
    setError('');
    limpiarAviso();
    setCargando(true);
    try {
      // Si el servicio todavia no desperto, lo esperamos antes de mandar
      // las credenciales, mostrando el progreso en pantalla.
      if (servidor.estado !== 'listo') {
        const despierto = await despertarServidor(setServidor);
        if (!despierto) {
          throw new Error('El servidor no responde. Esperá unos segundos y reintentá.');
        }
      }
      const datosUsuario = await login({
        rol: rolSeleccionado,
        especialidad: rolSeleccionado === 'medico' ? especialidad : undefined,
        usuario,
        password,
      });
      navigate(rutaSegunRol(datosUsuario.rol));
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setCargando(false);
    }
  }

  function rutaSegunRol(rol) {
    const mapa = {
      administrador: '/administrador',
      recepcion: '/recepcion',
      medico: '/terminal',
      enfermeria: '/enfermeria',
      farmacia: '/farmacia',
      laboratorio: '/laboratorio',
      imagenes: '/imagenes',
      quirofano: '/quirofano',
    };
    return mapa[rol] || '/';
  }

  return (
    <div className="login">
      <div className="login__panel-institucional">
        <div className="login__marca">
          <LogoPlummer size={52} animado />
          <div>
            <p className="login__marca-proyecto">Proyecto Plummer</p>
            <p className="login__marca-institucion">Mayo Clinic Buenos Aires</p>
          </div>
        </div>

        <div className="login__hero">
          <h1>Sistema Integral de Administración Hospitalaria</h1>
          <p className="login__homenaje">
            Homenaje al Dr. Henry Plummer, pionero de la Historia Clínica Unificada por paciente.
          </p>
        </div>

        <div className="login__pulso" aria-hidden="true">
          <svg viewBox="0 0 400 80" width="100%" height="80" preserveAspectRatio="none">
            {/* Trazo de fondo */}
            <polyline
              points="0,40 60,40 80,10 100,70 120,40 260,40 280,15 300,65 320,40 400,40"
              fill="none"
              stroke="rgba(244,247,250,0.16)"
              strokeWidth="2.5"
            />
            {/* Trazo que se dibuja de lado a lado, en bucle */}
            <polyline
              points="0,40 60,40 80,10 100,70 120,40 260,40 280,15 300,65 320,40 400,40"
              fill="none"
              stroke="#2fd39e"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 620,
                strokeDashoffset: 620,
                animation: 'trazo-ecg 3.4s cubic-bezier(0.45,0,0.25,1) infinite',
                '--largo-trazo': 620,
              }}
            />
          </svg>
        </div>

        {plummer && (
          <div className="login__plummer surgir">
            <img
              className="login__plummer-foto"
              src={plummer.imagen}
              alt={plummer.nombre}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div>
              <p className="login__plummer-nombre">{plummer.nombre} <span>{plummer.anios}</span></p>
              <p className="login__plummer-bio">
                En 1907, en la Mayo Clinic, reemplazó los cuadernos que cada médico llevaba por
                separado por un expediente único por paciente. Esa idea —la historia clínica
                unificada— da nombre a este sistema.
              </p>
            </div>
          </div>
        )}

        <p className="login__footer-institucional">© 2026 Mayo Clinic Buenos Aires — Argentina</p>
      </div>

      <div className="login__panel-acceso">
        <div className="login__tarjeta-acceso">
          <h2>Acceso al Sistema</h2>
          <p className="login__subtitulo">Seleccione su rol e ingrese sus credenciales</p>

          {avisoSesion && (
            <div className="login__aviso surgir" role="status">{avisoSesion}</div>
          )}

          {servidor.estado !== 'listo' && (
            <div className="login__despertando surgir" role="status">
              <span className="login__despertando-punto" />
              <div>
                <strong>
                  {servidor.estado === 'falla'
                    ? 'El servidor no responde'
                    : 'Despertando el servidor…'}
                </strong>
                <p>
                  {servidor.estado === 'falla'
                    ? 'Reintentá en unos segundos.'
                    : 'El servicio estaba en reposo. Suele tardar hasta un minuto la primera vez.'}
                </p>
                {servidor.estado !== 'falla' && (
                  <div className="login__barra">
                    <div
                      className="login__barra-relleno"
                      style={{ width: `${Math.min(100, (servidor.intento / servidor.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="login__grid-roles" role="radiogroup" aria-label="Rol de acceso">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.valor}
                role="radio"
                aria-checked={rolSeleccionado === r.valor}
                className={`login__tarjeta-rol ${rolSeleccionado === r.valor ? 'login__tarjeta-rol--activa' : ''}`}
                onClick={() => {
                  setRolSeleccionado(r.valor);
                  setError('');
                }}
              >
                <span className="login__tarjeta-rol-icono"><Icono tipo={r.icono} /></span>
                <span className="login__tarjeta-rol-label">{r.label}</span>
                <span className="login__tarjeta-rol-desc">{r.desc}</span>
              </button>
            ))}
          </div>

          {rolSeleccionado === 'medico' && (
            <div className="login__campo">
              <label htmlFor="especialidad">Especialidad / Terminal</label>
              <select
                id="especialidad"
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
              >
                {especialidades.map((esp) => (
                  <option key={esp.valor} value={esp.valor}>
                    {esp.label} — {esp.terminal}
                  </option>
                ))}
              </select>

              {especialidad && <HistoricoMedico especialidad={especialidad} />}
            </div>
          )}

          <form onSubmit={manejarEnvio} className="login__form">
            <div className="login__campo">
              <label htmlFor="usuario">Usuario</label>
              <input
                id="usuario"
                type="text"
                autoComplete="username"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder={rolSeleccionado === 'medico' ? 'Nombre y Apellido' : 'Usuario'}
                required
              />
            </div>

            <div className="login__campo">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                required
              />
            </div>

            {error && <p className="login__error" role="alert">{error}</p>}

            <button type="submit" className="login__boton-ingresar" disabled={cargando}>
              {cargando
                ? (servidor.estado === 'listo' ? 'Ingresando…' : 'Esperando al servidor…')
                : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

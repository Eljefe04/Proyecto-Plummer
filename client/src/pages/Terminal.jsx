import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import CampanaNotificaciones from '../components/CampanaNotificaciones';
import BandejaDerivaciones from '../components/BandejaDerivaciones';
import { TablaResultados } from './laboratorio/EstudiosLaboratorio';
import { api } from '../api';
import { useActualizacionTiempoReal } from '../hooks';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../components/ui';
import Modal from '../components/Modal';
import LogoPlummer from '../components/LogoPlummer';
import ModuloObstetricia from './terminal/ModuloObstetricia';
import ModuloCardiologia from './terminal/ModuloCardiologia';
import ModuloNeurologia from './terminal/ModuloNeurologia';
import ModuloPediatria from './terminal/ModuloPediatria';
import './Terminal.css';

const ESPECIALIDAD_INFO = {
  cardiologia: { label: 'Cardiología', icono: 'corazon', color: '#c23b3b' },
  neurologia: { label: 'Neurología', icono: 'cerebro', color: '#7c5cbf' },
  pediatria: { label: 'Pediatría', icono: 'bebe', color: '#4a94d1' },
  obstetricia: { label: 'Obstetricia', icono: 'obstetricia', color: '#2fa88c' },
};

const TABS = [
  { valor: 'recibidas', label: 'Derivaciones recibidas' },
  { valor: 'turnos', label: 'Turnos de Hoy' },
  { valor: 'estudios', label: 'Estudios' },
  { valor: 'recetas', label: 'Recetas Digitales' },
  { valor: 'derivaciones', label: 'Derivaciones' },
  { valor: 'especifico', label: 'Módulo Clínico' },
];

export default function Terminal() {
  const { usuario, logout } = useAuth();
  const [medico, setMedico] = useState(null);
  const [tab, setTab] = useState('turnos');
  const [turnos, setTurnos] = useState([]);
  const [pacienteBuscado, setPacienteBuscado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  const cargarTurnos = useCallback(() => {
    api.get('/turnos').then(setTurnos).catch(() => {});
  }, []);

  useEffect(() => {
    if (usuario?.medicoId) api.get(`/medicos/${usuario.medicoId}`).then(setMedico).catch(() => {});
  }, [usuario]);

  useEffect(() => { cargarTurnos(); }, [cargarTurnos]);
  useActualizacionTiempoReal('turnos', cargarTurnos);

  useEffect(() => {
    if (!busqueda) { setResultadosBusqueda([]); return; }
    const t = setTimeout(() => {
      api.get(`/pacientes?q=${encodeURIComponent(busqueda)}`).then(setResultadosBusqueda).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const info = medico ? ESPECIALIDAD_INFO[medico.especialidad] : null;
  const hoy = new Date().toISOString().slice(0, 10);
  // El medico ve su agenda completa, no solo el dia. Antes se traian
  // todos los turnos de la API y se descartaban los futuros al renderizar,
  // asi que un turno agendado para manana no aparecia en ningun lado.
  const turnosHoy = turnos.filter((t) => t.fecha === hoy);
  const turnosProximos = turnos.filter((t) => t.fecha > hoy);
  const turnosPasados = turnos.filter((t) => t.fecha < hoy);

  return (
    <div className="terminal">
      <header className="terminal__topbar">
        <div className="terminal__marca">
          <LogoPlummer size={30} />
          <span>Proyecto Plummer</span>
        </div>
        <div className="terminal__acciones">
          {/* La terminal medica era el unico modulo sin notificaciones:
              no usa LayoutInterno, asi que nunca recibia avisos de turnos,
              resultados ni derivaciones. */}
          <CampanaNotificaciones claro />
          <button className="terminal__salir" onClick={logout}>Cerrar sesión</button>
        </div>
      </header>

      <div className="terminal__body">
        {medico && (
          <div className="terminal__tarjeta-medico" style={{ background: `linear-gradient(120deg, ${info.color}22, ${info.color}11)`, borderColor: `${info.color}55` }}>
            <div className="terminal__tarjeta-medico-icono" style={{ background: info.color }}>
              <IconoEspecialidad tipo={info.icono} />
            </div>
            <div>
              <p className="terminal__tarjeta-medico-titulo">{info.label}</p>
              <p className="terminal__tarjeta-medico-sub">Terminal — Mayo Clinic BA</p>
            </div>
            <div className="terminal__tarjeta-medico-profesional">
              <p className="terminal__tarjeta-medico-label">Profesional</p>
              <p className="terminal__tarjeta-medico-nombre">{medico.nombre} {medico.apellido}</p>
            </div>
          </div>
        )}

        <div className="buscador" style={{ position: 'relative' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input placeholder="Buscar paciente por nombre o DNI para acceder a su HCE…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          {resultadosBusqueda.length > 0 && (
            <div className="terminal__resultados-busqueda">
              {resultadosBusqueda.map((p) => (
                <button key={p.id} onClick={() => { setPacienteBuscado(p); setBusqueda(''); setResultadosBusqueda([]); }}>
                  {p.apellido}, {p.nombre} — DNI {p.dni}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="terminal__tabs">
          {TABS.map((t) => (
            <button key={t.valor} className={`terminal__tab ${tab === t.valor ? 'terminal__tab--activo' : ''}`} onClick={() => setTab(t.valor)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'recibidas' && medico && (
          <BandejaDerivaciones
            destinos={[medico.especialidad]}
            titulo="Derivaciones recibidas"
            subtitulo={`Pacientes derivados a ${ESPECIALIDAD_INFO[medico.especialidad]?.label || medico.especialidad}`}
            onSeleccionar={(p) => { setPacienteBuscado(p); setTab('especifico'); }}
          />
        )}
        {tab === 'turnos' && (
          <TabTurnos
            turnosHoy={turnosHoy}
            turnosProximos={turnosProximos}
            turnosPasados={turnosPasados}
            hoy={hoy}
            onSeleccionar={setPacienteBuscado}
            pacienteActivo={pacienteBuscado}
            onAtendido={() => api.get('/turnos').then(setTurnos).catch(() => {})}
          />
        )}
        {tab === 'estudios' && <TabEstudios medicoId={usuario?.medicoId} pacienteBuscado={pacienteBuscado} />}
        {tab === 'recetas' && <TabRecetas medicoId={usuario?.medicoId} pacienteBuscado={pacienteBuscado} />}
        {tab === 'derivaciones' && <TabDerivaciones medico={medico} pacienteBuscado={pacienteBuscado} />}
        {tab === 'especifico' && medico && <ModuloEspecifico especialidad={medico.especialidad} pacienteBuscado={pacienteBuscado} />}
      </div>
    </div>
  );
}

function TablaTurnos({ turnos, onSeleccionar, pacienteActivo, onAtendido, mostrarFecha, permitirAtender }) {
  const [error, setError] = useState('');

  async function marcarAtendido(id) {
    setError('');
    try {
      await api.patch(`/turnos/${id}/estado`, { estado: 'atendido' });
      onAtendido();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      {error && <div className="aviso-error">{error}</div>}
      <table className="tabla tabla-responsive">
        <thead>
          <tr>
            {mostrarFecha && <th>Fecha</th>}
            <th>Hora</th><th>Paciente</th><th>Modalidad</th><th>Motivo</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          {turnos.map((t) => {
            const activo = pacienteActivo && pacienteActivo.id === t.paciente_id;
            return (
              <tr key={t.id} className={activo ? 'fila--seleccionada' : ''}>
                {mostrarFecha && (
                  <td data-label="Fecha">
                    {new Date(`${t.fecha}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </td>
                )}
                <td data-label="Hora"><strong>{t.hora}</strong></td>
                <td data-label="Paciente">{t.paciente_apellido}, {t.paciente_nombre}</td>
                <td data-label="Modalidad" style={{ textTransform: 'capitalize' }}>
                  {t.modalidad}
                  {t.codigo_videollamada && (
                    <span className="codigo-videollamada">{t.codigo_videollamada}</span>
                  )}
                </td>
                <td data-label="Motivo">{t.motivo_consulta || '—'}</td>
                <td data-label="Estado">
                  <span className={`estado-chip estado-chip--${
                    t.estado === 'atendido' ? 'libre' : t.estado === 'confirmado' ? 'curso' : 'pendiente'
                  }`}>{t.estado}</span>
                </td>
                <td data-label="">
                  <div className="turno-acciones">
                    {/* Seleccionar el paciente desde su propio turno, sin
                        tener que buscarlo a mano en el buscador. */}
                    <Boton
                      variante={activo ? 'primario' : 'secundario'}
                      tamano="sm"
                      onClick={() => onSeleccionar({
                        id: t.paciente_id,
                        nombre: t.paciente_nombre,
                        apellido: t.paciente_apellido,
                        dni: t.paciente_dni,
                      })}
                    >
                      {activo ? 'Seleccionado' : 'Atender'}
                    </Boton>
                    {permitirAtender && t.estado !== 'atendido' && (
                      <Boton variante="secundario" tamano="sm" onClick={() => marcarAtendido(t.id)}>
                        Cerrar turno
                      </Boton>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function TabTurnos({ turnosHoy, turnosProximos, turnosPasados, onSeleccionar, pacienteActivo, onAtendido }) {
  const [vista, setVista] = useState('hoy');
  const listas = { hoy: turnosHoy, proximos: turnosProximos, historial: turnosPasados };
  const actual = listas[vista] || [];

  return (
    <div className="pila-secciones">
      {turnosHoy.length > 0 && vista === 'hoy' && (
        <div className="proximo-turno surgir">
          <p className="proximo-turno__label">Próximo turno</p>
          <p className="proximo-turno__paciente">
            {turnosHoy[0].paciente_apellido}, {turnosHoy[0].paciente_nombre}
          </p>
          <p className="proximo-turno__meta">
            {turnosHoy[0].hora} · {turnosHoy[0].modalidad}
            {turnosHoy[0].motivo_consulta ? ` · ${turnosHoy[0].motivo_consulta}` : ''}
          </p>
          {turnosHoy[0].codigo_videollamada && (
            <p className="proximo-turno__codigo">
              Código de reunión: <strong>{turnosHoy[0].codigo_videollamada}</strong>
            </p>
          )}
        </div>
      )}

      <TarjetaSeccion
        titulo="Mi agenda"
        acciones={
          <div className="mini-tabs">
            {[
              { v: 'hoy', l: `Hoy (${turnosHoy.length})` },
              { v: 'proximos', l: `Próximos (${turnosProximos.length})` },
              { v: 'historial', l: `Historial (${turnosPasados.length})` },
            ].map((o) => (
              <button
                key={o.v}
                className={`mini-tab ${vista === o.v ? 'mini-tab--activo' : ''}`}
                onClick={() => setVista(o.v)}
              >
                {o.l}
              </button>
            ))}
          </div>
        }
      >
        {actual.length === 0 ? (
          <EstadoVacio texto={
            vista === 'hoy' ? 'No hay turnos para hoy.'
            : vista === 'proximos' ? 'No hay turnos agendados a futuro.'
            : 'No hay turnos anteriores.'
          } />
        ) : (
          <TablaTurnos
            turnos={actual}
            onSeleccionar={onSeleccionar}
            pacienteActivo={pacienteActivo}
            onAtendido={onAtendido}
            mostrarFecha={vista !== 'hoy'}
            permitirAtender={vista !== 'proximos'}
          />
        )}
      </TarjetaSeccion>
    </div>
  );
}

function TabEstudios({ medicoId, pacienteBuscado }) {
  const [estudiosLab, setEstudiosLab] = useState([]);
  const [estudiosImg, setEstudiosImg] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tipoEstudio, setTipoEstudio] = useState('laboratorio');
  const [nombreEstudio, setNombreEstudio] = useState('');
  const [prioridad, setPrioridad] = useState('normal');
  const [enviando, setEnviando] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [verResultado, setVerResultado] = useState(null);

  useEffect(() => {
    api.get('/laboratorio/catalogo').then(setCatalogo).catch(() => {});
  }, []);

  const cargar = useCallback(() => {
    if (!medicoId) return;
    api.get(`/laboratorio?medico_id=${medicoId}`).then(setEstudiosLab).catch(() => {});
    api.get(`/imagenes?medico_id=${medicoId}`).then(setEstudiosImg).catch(() => {});
  }, [medicoId]);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal('estudios_laboratorio', cargar);
  useActualizacionTiempoReal('estudios_imagenes', cargar);

  async function solicitar(e) {
    e.preventDefault();
    if (!pacienteBuscado) return;
    setEnviando(true);
    try {
      if (tipoEstudio === 'laboratorio') {
        await api.post('/laboratorio', { paciente_id: pacienteBuscado.id, estudios: [nombreEstudio], prioridad });
      } else {
        await api.post('/imagenes', { paciente_id: pacienteBuscado.id, tipo_estudio: nombreEstudio, prioridad });
      }
      setModalAbierto(false);
      setNombreEstudio('');
      cargar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TarjetaSeccion
      titulo="Solicitud de Estudios"
      acciones={<Boton onClick={() => setModalAbierto(true)} disabled={!pacienteBuscado}>+ Nueva Solicitud</Boton>}
    >
      {!pacienteBuscado && <p className="ayuda-campo" style={{ marginBottom: 12 }}>Buscá un paciente arriba para solicitarle un estudio.</p>}
      {[...estudiosLab, ...estudiosImg].length === 0 ? (
        <EstadoVacio texto="No hay estudios solicitados." />
      ) : (
        <div className="lista-derivaciones">
          {estudiosLab.map((e) => {
            const alterados = (e.valores || []).filter((v) => v.fuera_de_rango).length;
            const listo = e.estado === 'realizado';
            return (
              <article key={e.id} className="tarjeta-derivacion surgir">
                <div className="tarjeta-derivacion__cabecera">
                  <div>
                    <p className="tarjeta-derivacion__paciente">
                      {e.paciente_apellido}, {e.paciente_nombre}
                    </p>
                    <p className="tarjeta-derivacion__meta">
                      Laboratorio · {e.estudios.join(' · ')}
                    </p>
                  </div>
                  <span className={`estado-chip estado-chip--${
                    listo ? (alterados > 0 ? 'urgente' : 'libre')
                    : e.prioridad === 'urgente' ? 'urgente' : 'pendiente'
                  }`}>
                    {listo
                      ? (alterados > 0 ? `${alterados} fuera de rango` : 'Resultado normal')
                      : String(e.estado).replace('_', ' ')}
                  </span>
                </div>
                {listo && (
                  <div className="tarjeta-derivacion__pie">
                    <span />
                    <Boton variante="secundario" onClick={() => setVerResultado(e)}>
                      Ver resultado
                    </Boton>
                  </div>
                )}
              </article>
            );
          })}

          {estudiosImg.map((e) => (
            <article key={e.id} className="tarjeta-derivacion surgir">
              <div className="tarjeta-derivacion__cabecera">
                <div>
                  {/* Antes acá figuraba la palabra literal "Paciente":
                      el nombre no llegaba porque la consulta filtrada por
                      médico no hacía JOIN con la tabla de pacientes. */}
                  <p className="tarjeta-derivacion__paciente">
                    {e.paciente_apellido}, {e.paciente_nombre}
                  </p>
                  <p className="tarjeta-derivacion__meta">
                    Imágenes · {e.tipo_estudio}{e.region ? ` (${e.region})` : ''}
                  </p>
                </div>
                <span className={`estado-chip estado-chip--${
                  e.estado === 'informado' || e.estado === 'realizado' ? 'libre'
                  : e.prioridad === 'urgente' ? 'urgente' : 'pendiente'
                }`}>
                  {String(e.estado).replace('_', ' ')}
                </span>
              </div>
              {e.informe && (
                <div className="receta-detalle">
                  <p className="receta-detalle__indicaciones">{e.informe}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {verResultado && (
        <Modal
          abierto
          ancho={680}
          titulo={`${verResultado.paciente_apellido}, ${verResultado.paciente_nombre}`}
          onCerrar={() => setVerResultado(null)}
        >
          <TablaResultados estudio={verResultado} />
        </Modal>
      )}

      <Modal titulo="Solicitar Estudio" abierto={modalAbierto} onCerrar={() => setModalAbierto(false)}>
        <form onSubmit={solicitar}>
          <div className="formulario-grid" style={{ gridTemplateColumns: '1fr' }}>
            <Campo label="Paciente"><input disabled value={pacienteBuscado ? `${pacienteBuscado.apellido}, ${pacienteBuscado.nombre}` : ''} /></Campo>
            <Campo label="Tipo">
              <select value={tipoEstudio} onChange={(e) => setTipoEstudio(e.target.value)}>
                <option value="laboratorio">Laboratorio</option>
                <option value="imagenes">Imágenes (Rx / Tomografía / Ecografía)</option>
              </select>
            </Campo>
            <Campo label="Nombre del estudio"><input required value={nombreEstudio} onChange={(e) => setNombreEstudio(e.target.value)} /></Campo>
            <Campo label="Prioridad">
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="urgente">Urgente</option>
              </select>
            </Campo>
          </div>
          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Solicitar'}</Boton>
          </div>
        </form>
      </Modal>
    </TarjetaSeccion>
  );
}

function TabRecetas({ medicoId, pacienteBuscado }) {
  const [recetas, setRecetas] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState({ medicamento: '', dosis: '', via_administracion: '', frecuencia: '', duracion_tratamiento: '', indicaciones: '' });
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    if (medicoId) api.get(`/recetas?medico_id=${medicoId}`).then(setRecetas).catch(() => {});
  }, [medicoId]);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal('recetas', cargar);

  async function emitir(e) {
    e.preventDefault();
    if (!pacienteBuscado) return;
    setEnviando(true);
    try {
      await api.post('/recetas', { paciente_id: pacienteBuscado.id, ...form });
      setModalAbierto(false);
      setForm({ medicamento: '', dosis: '', via_administracion: '', frecuencia: '', duracion_tratamiento: '', indicaciones: '' });
      cargar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TarjetaSeccion titulo="Recetas Digitales" acciones={<Boton onClick={() => setModalAbierto(true)} disabled={!pacienteBuscado}>+ Nueva Receta</Boton>}>
      {!pacienteBuscado && <p className="ayuda-campo" style={{ marginBottom: 12 }}>Buscá un paciente arriba para emitirle una receta.</p>}
      {recetas.length === 0 ? (
        <EstadoVacio texto="No hay recetas emitidas." />
      ) : (
        <table className="tabla">
          <thead><tr><th>Paciente</th><th>Medicamento</th><th>Dosis</th><th>Estado</th></tr></thead>
          <tbody>
            {recetas.map((r) => (
              <tr key={r.id}><td>{r.paciente_apellido}, {r.paciente_nombre}</td><td>{r.medicamento}</td><td>{r.dosis}</td><td><Badge tipo={r.estado === 'dispensada' ? 'exito' : 'alerta'}>{r.estado}</Badge></td></tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal titulo="Nueva Receta Digital" abierto={modalAbierto} onCerrar={() => setModalAbierto(false)}>
        <form onSubmit={emitir}>
          <div className="formulario-grid">
            <Campo label="Paciente" ancho={2}><input disabled value={pacienteBuscado ? `${pacienteBuscado.apellido}, ${pacienteBuscado.nombre}` : ''} /></Campo>
            <Campo label="Medicamento" ancho={2}><input required value={form.medicamento} onChange={(e) => setForm({ ...form, medicamento: e.target.value })} /></Campo>
            <Campo label="Dosis"><input value={form.dosis} onChange={(e) => setForm({ ...form, dosis: e.target.value })} /></Campo>
            <Campo label="Vía de administración"><input value={form.via_administracion} onChange={(e) => setForm({ ...form, via_administracion: e.target.value })} /></Campo>
            <Campo label="Frecuencia"><input value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })} /></Campo>
            <Campo label="Duración del tratamiento"><input value={form.duracion_tratamiento} onChange={(e) => setForm({ ...form, duracion_tratamiento: e.target.value })} /></Campo>
            <Campo label="Indicaciones" ancho={2}><textarea rows={2} value={form.indicaciones} onChange={(e) => setForm({ ...form, indicaciones: e.target.value })} /></Campo>
          </div>
          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton type="submit" disabled={enviando}>{enviando ? 'Emitiendo…' : 'Emitir Receta'}</Boton>
          </div>
        </form>
      </Modal>
    </TarjetaSeccion>
  );
}

function TabDerivaciones({ medico, pacienteBuscado }) {
  const [derivaciones, setDerivaciones] = useState([]);
  const [areas, setAreas] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { api.get('/pacientes/areas-derivacion').then(setAreas).catch(() => {}); }, []);

  const cargar = useCallback(() => {
    if (pacienteBuscado) api.get(`/derivaciones?paciente_id=${pacienteBuscado.id}`).then(setDerivaciones).catch(() => {});
    else setDerivaciones([]);
  }, [pacienteBuscado]);

  useEffect(() => { cargar(); }, [cargar]);

  async function derivar(e) {
    e.preventDefault();
    if (!pacienteBuscado || !medico) return;
    setEnviando(true);
    try {
      await api.post('/derivaciones', { paciente_id: pacienteBuscado.id, origen: medico.especialidad, destino, motivo });
      setModalAbierto(false);
      setDestino(''); setMotivo('');
      cargar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TarjetaSeccion titulo="Derivaciones" acciones={<Boton onClick={() => setModalAbierto(true)} disabled={!pacienteBuscado}>+ Nueva Derivación</Boton>}>
      {!pacienteBuscado && <p className="ayuda-campo" style={{ marginBottom: 12 }}>Buscá un paciente arriba para derivarlo.</p>}
      {derivaciones.length === 0 ? (
        <EstadoVacio texto="No hay derivaciones registradas." />
      ) : (
        <table className="tabla">
          <thead><tr><th>Origen</th><th>Destino</th><th>Motivo</th></tr></thead>
          <tbody>
            {derivaciones.map((d) => (
              <tr key={d.id}><td style={{ textTransform: 'capitalize' }}>{d.origen}</td><td style={{ textTransform: 'capitalize' }}>{d.destino}</td><td>{d.motivo || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal titulo="Nueva Derivación" abierto={modalAbierto} onCerrar={() => setModalAbierto(false)}>
        <form onSubmit={derivar}>
          <div className="formulario-grid" style={{ gridTemplateColumns: '1fr' }}>
            <Campo label="Área de destino">
              <select required value={destino} onChange={(e) => setDestino(e.target.value)}>
                <option value="">Seleccionar…</option>
                {areas.map((a) => <option key={a.valor} value={a.valor}>{a.label}</option>)}
              </select>
            </Campo>
            <Campo label="Motivo de derivación"><textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
          </div>
          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton type="submit" disabled={enviando}>{enviando ? 'Derivando…' : 'Derivar Paciente'}</Boton>
          </div>
        </form>
      </Modal>
    </TarjetaSeccion>
  );
}

function ModuloEspecifico({ especialidad, pacienteBuscado }) {
  if (!pacienteBuscado) {
    return <TarjetaSeccion titulo="Módulo Clínico"><EstadoVacio texto="Buscá un paciente arriba para acceder a las funciones específicas de la especialidad." /></TarjetaSeccion>;
  }
  if (especialidad === 'obstetricia') return <ModuloObstetricia paciente={pacienteBuscado} />;
  if (especialidad === 'cardiologia') return <ModuloCardiologia paciente={pacienteBuscado} />;
  if (especialidad === 'neurologia') return <ModuloNeurologia paciente={pacienteBuscado} />;
  if (especialidad === 'pediatria') return <ModuloPediatria paciente={pacienteBuscado} />;
  return null;
}

function IconoEspecialidad({ tipo }) {
  const paths = {
    corazon: 'M12 20s-7-4.4-9.3-8.8C1.2 8.1 3 5 6.2 5c1.8 0 3.2 1 3.8 2.4C10.6 6 12 5 13.8 5 17 5 18.8 8.1 21.3 11.2 19 15.6 12 20 12 20Z',
    cerebro: 'M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5 3 3 0 0 0 2 5v1a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM15 3a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5 3 3 0 0 1-2 5v1a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z',
    bebe: 'M12 2a5 5 0 0 0-5 5c0 2 1 3 1 3s-3 0-3 4 3 8 7 8 7-4 7-8-3-4-3-4 1-1 1-3a5 5 0 0 0-5-5Z',
    obstetricia: 'M12 3C9 3 7 5.5 7 8c0 4 3 5 3 9a2 2 0 0 0 4 0c0-4 3-5 3-9 0-2.5-2-5-5-5Z',
  };
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d={paths[tipo] || paths.corazon} /></svg>
  );
}

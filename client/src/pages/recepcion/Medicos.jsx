import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';

const ESPECIALIDADES = [
  { valor: 'obstetricia', label: 'Obstetricia' },
  { valor: 'cardiologia', label: 'Cardiología' },
  { valor: 'neurologia', label: 'Neurología' },
  { valor: 'pediatria', label: 'Pediatría' },
];
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const MEDICO_VACIO = {
  nombre: '', apellido: '', dni: '', matricula: '', especialidad: 'cardiologia', consultorio: '',
  telefono: '', email: '', hora_inicio: '08:00', hora_fin: '13:00', duracion_turno_min: 30, dias_atencion: [],
};

export default function Medicos() {
  const [medicos, setMedicos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEsp, setFiltroEsp] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(null);
  const [confirmacionTexto, setConfirmacionTexto] = useState('');
  const [form, setForm] = useState(MEDICO_VACIO);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [credencialCreada, setCredencialCreada] = useState(null);

  const cargar = useCallback(() => {
    api.get(`/medicos${filtroEsp ? `?especialidad=${filtroEsp}` : ''}`).then(setMedicos).catch(() => {});
  }, [filtroEsp]);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirNuevo() {
    setForm(MEDICO_VACIO);
    setError('');
    setCredencialCreada(null);
    setModalAbierto(true);
  }

  function toggleDia(dia) {
    setForm((f) => ({
      ...f,
      dias_atencion: f.dias_atencion.includes(dia) ? f.dias_atencion.filter((d) => d !== dia) : [...f.dias_atencion, dia],
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await api.post('/medicos', form);
      setCredencialCreada(`${form.nombre} ${form.apellido}`);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function toggleBaja(id) {
    await api.patch(`/medicos/${id}/baja`);
    cargar();
  }

  async function eliminarDefinitivo() {
    if (confirmacionTexto !== 'ELIMINAR') return;
    await api.delete(`/medicos/${modalEliminar.id}`);
    setModalEliminar(null);
    setConfirmacionTexto('');
    cargar();
  }

  const filtrados = medicos.filter((m) => {
    const nombreCompleto = `${m.nombre} ${m.apellido}`.toLowerCase();
    return nombreCompleto.includes(busqueda.toLowerCase()) || (m.matricula || '').toLowerCase().includes(busqueda.toLowerCase());
  });

  return (
    <TarjetaSeccion
      titulo={`Gestión de Médicos — ${medicos.filter((m) => m.estado === 'activo').length} activos · ${medicos.length} totales`}
      acciones={<Boton onClick={abrirNuevo}>+ Nuevo Médico</Boton>}
    >
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="buscador" style={{ flex: 1, marginBottom: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input placeholder="Buscar por nombre o matrícula…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <select value={filtroEsp} onChange={(e) => setFiltroEsp(e.target.value)} style={{ padding: '10px 14px', border: '1.5px solid var(--borde-medio)', borderRadius: 'var(--radio-sm)' }}>
          <option value="">Todas las especialidades</option>
          {ESPECIALIDADES.map((e) => <option key={e.valor} value={e.valor}>{e.label}</option>)}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <EstadoVacio texto="No hay médicos que coincidan con la búsqueda." />
      ) : (
        <div className="grid-medicos">
          {filtrados.map((m) => (
            <div key={m.id} className="tarjeta-medico">
              <div className="tarjeta-medico__header">
                <div className="tarjeta-medico__avatar">{m.nombre.charAt(0)}{m.apellido.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="tarjeta-medico__nombre">Dr./Dra. {m.nombre} {m.apellido}</p>
                  <p className="tarjeta-medico__matricula">MP: {m.matricula}</p>
                </div>
                <Badge tipo={m.estado === 'activo' ? 'exito' : 'neutro'}>{m.estado}</Badge>
              </div>
              <Badge tipo="info">{ESPECIALIDADES.find((e) => e.valor === m.especialidad)?.label || m.especialidad}</Badge>
              <div className="tarjeta-medico__detalle">
                {m.consultorio && <p>{m.consultorio}</p>}
                {m.dias_atencion?.length > 0 && (
                  <p>{m.dias_atencion.join(', ')} · {m.hora_inicio}-{m.hora_fin} ({m.duracion_turno_min}min)</p>
                )}
                {m.telefono && <p>{m.telefono}</p>}
              </div>
              <div className="tarjeta-medico__acciones">
                <Boton variante="secundario" tamano="sm" onClick={() => toggleBaja(m.id)}>
                  {m.estado === 'activo' ? 'Dar de baja' : 'Reactivar'}
                </Boton>
                <button className="icono-boton icono-boton--peligro" title="Eliminar definitivamente" onClick={() => { setModalEliminar(m); setConfirmacionTexto(''); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal titulo="Nuevo Médico" abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} ancho={620}>
        {credencialCreada ? (
          <div>
            <p className="modal-advertencia" style={{ background: '#e1f5ee', borderColor: '#9fe1cb', color: '#0f6e56' }}>
              Médico creado correctamente. Su acceso a la terminal de {ESPECIALIDADES.find((e) => e.valor === form.especialidad)?.label} ya está habilitado.
              <br /><br />
              <strong>Usuario y contraseña:</strong> {credencialCreada}
            </p>
            <div className="form-acciones">
              <Boton onClick={() => setModalAbierto(false)}>Entendido</Boton>
            </div>
          </div>
        ) : (
          <form onSubmit={guardar}>
            <div className="formulario-grid">
              <Campo label="Nombre *"><input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Campo>
              <Campo label="Apellido *"><input required value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></Campo>
              <Campo label="DNI"><input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} /></Campo>
              <Campo label="Matrícula *"><input required value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></Campo>
              <Campo label="Especialidad *">
                <select required value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })}>
                  {ESPECIALIDADES.map((e) => <option key={e.valor} value={e.valor}>{e.label}</option>)}
                </select>
              </Campo>
              <Campo label="Consultorio"><input placeholder="Ej: Consultorio 1" value={form.consultorio} onChange={(e) => setForm({ ...form, consultorio: e.target.value })} /></Campo>
              <Campo label="Teléfono"><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Campo>
              <Campo label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo>
            </div>

            <p className="form-subtitulo">Agenda del Médico</p>
            <div className="formulario-grid">
              <Campo label="Hora inicio"><input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} /></Campo>
              <Campo label="Hora fin"><input type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} /></Campo>
              <Campo label="Duración turno (min)"><input type="number" min={5} step={5} value={form.duracion_turno_min} onChange={(e) => setForm({ ...form, duracion_turno_min: Number(e.target.value) })} /></Campo>
            </div>

            <Campo label="Días de atención">
              <div className="dias-selector">
                {DIAS.map((d) => (
                  <button
                    type="button"
                    key={d}
                    className={`dias-selector__item ${form.dias_atencion.includes(d) ? 'dias-selector__item--activo' : ''}`}
                    onClick={() => toggleDia(d)}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </Campo>

            <p className="modal-advertencia" style={{ marginTop: 16 }}>
              Al crear el médico, su acceso a la terminal de {ESPECIALIDADES.find((e) => e.valor === form.especialidad)?.label} se habilita automáticamente.
              Usuario y contraseña = <strong>{form.nombre} {form.apellido}</strong>.
            </p>

            {error && <p className="form-error">{error}</p>}

            <div className="form-acciones">
              <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
              <Boton type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Crear Médico'}</Boton>
            </div>
          </form>
        )}
      </Modal>

      <Modal titulo="Eliminar médico definitivamente" abierto={!!modalEliminar} onCerrar={() => setModalEliminar(null)} ancho={460}>
        {modalEliminar && (
          <div>
            <p className="modal-advertencia">
              Esta acción eliminará de forma permanente a <strong>Dr./Dra. {modalEliminar.nombre} {modalEliminar.apellido}</strong> y
              todos sus turnos históricos asociados. Se recomienda usar <strong>Dar de baja</strong> para conservar el historial.
            </p>
            <Campo label='Para confirmar, escribí "ELIMINAR"'>
              <input value={confirmacionTexto} onChange={(e) => setConfirmacionTexto(e.target.value)} />
            </Campo>
            <div className="form-acciones">
              <Boton variante="secundario" onClick={() => setModalEliminar(null)}>Cancelar</Boton>
              <Boton variante="peligro" disabled={confirmacionTexto !== 'ELIMINAR'} onClick={eliminarDefinitivo}>Eliminar definitivamente</Boton>
            </div>
          </div>
        )}
      </Modal>
    </TarjetaSeccion>
  );
}

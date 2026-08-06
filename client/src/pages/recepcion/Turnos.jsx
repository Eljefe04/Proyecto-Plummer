import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';
import { useActualizacionTiempoReal } from '../../hooks';

const ESTADO_BADGE = { pendiente: 'alerta', confirmado: 'info', atendido: 'exito', cancelado: 'neutro' };

export default function Turnos() {
  const [turnos, setTurnos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [pacienteId, setPacienteId] = useState('');
  const [medicoId, setMedicoId] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [modalidad, setModalidad] = useState('presencial');
  const [motivo, setMotivo] = useState('');
  const [disponibilidad, setDisponibilidad] = useState(null);

  const cargar = useCallback(() => {
    api.get('/turnos').then(setTurnos).catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    api.get('/pacientes').then(setPacientes).catch(() => {});
    api.get('/medicos').then(setMedicos).catch(() => {});
  }, []);
  useActualizacionTiempoReal('turnos', cargar);

  useEffect(() => {
    if (!medicoId || !fecha) { setDisponibilidad(null); return; }
    api.get(`/turnos/disponibilidad/${medicoId}?fecha=${fecha}`).then(setDisponibilidad).catch(() => setDisponibilidad(null));
  }, [medicoId, fecha]);

  function abrirNuevo() {
    setPacienteId(''); setMedicoId(''); setFecha(''); setHora(''); setModalidad('presencial'); setMotivo('');
    setDisponibilidad(null);
    setError('');
    setModalAbierto(true);
  }

  async function crearTurno(e) {
    e.preventDefault();
    setError('');
    if (!hora) {
      setError('Debe seleccionar un horario disponible de la agenda del médico.');
      return;
    }
    setGuardando(true);
    try {
      await api.post('/turnos', { paciente_id: pacienteId, medico_id: medicoId, fecha, hora, modalidad, motivo_consulta: motivo });
      setModalAbierto(false);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarTurno(id) {
    await api.delete(`/turnos/${id}`);
    cargar();
  }

  return (
    <TarjetaSeccion titulo={`Gestión de Turnos — ${turnos.length} registrados`} acciones={<Boton onClick={abrirNuevo}>+ Nuevo Turno</Boton>}>
      {turnos.length === 0 ? (
        <EstadoVacio texto="No hay turnos registrados todavía." />
      ) : (
        <table className="tabla">
          <thead><tr><th>Fecha / Hora</th><th>Paciente</th><th>Médico</th><th>Especialidad</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {turnos.map((t) => (
              <tr key={t.id}>
                <td>{t.fecha} <span style={{ color: 'var(--texto-secundario)' }}>{t.hora}</span></td>
                <td>{t.paciente_apellido}, {t.paciente_nombre}</td>
                <td>{t.medico_nombre} {t.medico_apellido}</td>
                <td style={{ textTransform: 'capitalize' }}>{t.especialidad}</td>
                <td><Badge tipo={ESTADO_BADGE[t.estado] || 'neutro'}>{t.estado}</Badge></td>
                <td>
                  <div className="tabla__acciones">
                    <button className="icono-boton icono-boton--peligro" title="Eliminar turno" onClick={() => eliminarTurno(t.id)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal titulo="Nuevo Turno" abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} ancho={520}>
        <form onSubmit={crearTurno}>
          <div className="formulario-grid" style={{ gridTemplateColumns: '1fr' }}>
            <Campo label="Paciente">
              <select required value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
                <option value="">Seleccionar paciente…</option>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre} — DNI {p.dni}</option>)}
              </select>
            </Campo>
            <Campo label="Médico">
              <select required value={medicoId} onChange={(e) => { setMedicoId(e.target.value); setHora(''); }}>
                <option value="">Seleccionar médico…</option>
                {medicos.filter((m) => m.estado === 'activo').map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre} {m.apellido} — {m.especialidad}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Fecha">
              <input type="date" required value={fecha} onChange={(e) => { setFecha(e.target.value); setHora(''); }} />
            </Campo>

            {medicoId && fecha && (
              <Campo label="Horario disponible">
                {!disponibilidad ? (
                  <p className="ayuda-campo">Cargando disponibilidad…</p>
                ) : !disponibilidad.agendaConfigurada ? (
                  <p className="ayuda-campo ayuda-campo--error">Este médico no tiene agenda configurada. No se puede cargar el turno.</p>
                ) : disponibilidad.horarios.length === 0 ? (
                  <p className="ayuda-campo ayuda-campo--error">{disponibilidad.motivo || 'No hay horarios libres ese día.'}</p>
                ) : (
                  <div className="grilla-horarios">
                    {disponibilidad.horarios.map((h) => (
                      <button
                        type="button"
                        key={h}
                        className={`grilla-horarios__item ${hora === h ? 'grilla-horarios__item--activo' : ''}`}
                        onClick={() => setHora(h)}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}
              </Campo>
            )}

            <Campo label="Modalidad">
              <select value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
                <option value="presencial">Presencial</option>
                <option value="telemedicina">Telemedicina</option>
              </select>
            </Campo>
            <Campo label="Motivo de consulta">
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </Campo>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton type="submit" disabled={guardando || !hora}>{guardando ? 'Creando…' : 'Crear Turno'}</Boton>
          </div>
        </form>
      </Modal>
    </TarjetaSeccion>
  );
}

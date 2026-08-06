import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';

export default function Anestesiologia() {
  const [fichas, setFichas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pacienteId, setPacienteId] = useState('');
  const [cirugiaPendiente, setCirugiaPendiente] = useState(null);
  const [tipoAnestesia, setTipoAnestesia] = useState('general');
  const [asa, setAsa] = useState('ASA I');
  const [evaluacion, setEvaluacion] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api.get('/quirofano/fichas-anestesicas').then(setFichas).catch(() => {});
  }, []);

  useEffect(() => { cargar(); api.get('/pacientes').then(setPacientes).catch(() => {}); }, [cargar]);

  useEffect(() => {
    if (!pacienteId) { setCirugiaPendiente(null); return; }
    api.get(`/quirofano/cirugia-pendiente/${pacienteId}`).then(setCirugiaPendiente).catch(() => setCirugiaPendiente(null));
  }, [pacienteId]);

  function abrirNuevo() {
    setPacienteId(''); setCirugiaPendiente(null); setTipoAnestesia('general'); setAsa('ASA I'); setEvaluacion('');
    setError('');
    setModalAbierto(true);
  }

  async function crearFicha(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/quirofano/fichas-anestesicas', {
        paciente_id: pacienteId,
        cirugia_id: cirugiaPendiente?.id || null,
        tipo_anestesia: tipoAnestesia,
        clasificacion_asa: asa,
        evaluacion_preanestesica: evaluacion,
      });
      setModalAbierto(false);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <TarjetaSeccion titulo={`Anestesiología y Reanimación — ${fichas.length} fichas registradas`} acciones={<Boton onClick={abrirNuevo}>+ Nueva Ficha</Boton>}>
      {fichas.length === 0 ? (
        <EstadoVacio texto="No hay fichas anestésicas registradas." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fichas.map((f) => (
            <div key={f.id} className="tarjeta-estudio">
              <div style={{ flex: 1 }}>
                <p className="tarjeta-estudio__titulo">{f.paciente_nombre} {f.paciente_apellido}</p>
                <p className="tarjeta-estudio__meta">Anestesia {f.tipo_anestesia} · {f.clasificacion_asa}</p>
                {f.evaluacion_preanestesica && <p className="tarjeta-estudio__meta">{f.evaluacion_preanestesica}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal titulo="Ficha de Evaluación Preanestésica" abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} ancho={560}>
        <form onSubmit={crearFicha}>
          <Campo label="Paciente *">
            <select required value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
              <option value="">Seleccionar paciente…</option>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
            </select>
          </Campo>

          {pacienteId && (
            cirugiaPendiente ? (
              <div className="modal-advertencia" style={{ background: '#e6f1fb', borderColor: '#b5d4f4', color: '#0c447c' }}>
                Cirugía pendiente encontrada: <strong>{cirugiaPendiente.tipo_cirugia}</strong>
                {' '}— {cirugiaPendiente.quirofano}, {cirugiaPendiente.fecha_programada} {cirugiaPendiente.hora_inicio}
              </div>
            ) : (
              <p className="ayuda-campo">Este paciente no tiene una cirugía pendiente asociada.</p>
            )
          )}

          <div className="formulario-grid" style={{ marginTop: 12 }}>
            <Campo label="Tipo de anestesia">
              <select value={tipoAnestesia} onChange={(e) => setTipoAnestesia(e.target.value)}>
                <option value="general">General</option>
                <option value="regional">Regional</option>
                <option value="local">Local</option>
                <option value="sedacion">Sedación</option>
              </select>
            </Campo>
            <Campo label="Clasificación ASA">
              <select value={asa} onChange={(e) => setAsa(e.target.value)}>
                <option>ASA I</option><option>ASA II</option><option>ASA III</option><option>ASA IV</option><option>ASA V</option>
              </select>
            </Campo>
          </div>
          <Campo label="Evaluación preanestésica">
            <textarea rows={4} value={evaluacion} onChange={(e) => setEvaluacion(e.target.value)} />
          </Campo>

          {error && <p className="form-error">{error}</p>}
          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton type="submit">Crear Ficha</Boton>
          </div>
        </form>
      </Modal>
    </TarjetaSeccion>
  );
}

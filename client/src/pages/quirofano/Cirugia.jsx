import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';
import { useActualizacionTiempoReal } from '../../hooks';

const ESTADO_BADGE = { programada: 'info', en_curso: 'alerta', finalizada: 'exito', cancelada: 'neutro' };

const CIRUGIA_VACIA = {
  paciente_id: '', tipo_cirugia: '', caracter: 'programada', tipo_intervencion: 'ambulatoria',
  cirujano_id: '', anestesiologo: '', quirofano: 'Quirófano A', fecha_programada: '', hora_inicio: '',
  duracion_estimada: '', equipo_quirurgico: '', notas_prequirurgicas: '',
};

export default function Cirugia() {
  const [cirugias, setCirugias] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [form, setForm] = useState(CIRUGIA_VACIA);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api.get('/quirofano/cirugias').then(setCirugias).catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    api.get('/pacientes').then(setPacientes).catch(() => {});
    api.get('/medicos').then(setMedicos).catch(() => {});
  }, [cargar]);
  useActualizacionTiempoReal('cirugias', cargar);

  function abrirNuevo() {
    setForm(CIRUGIA_VACIA);
    setError('');
    setModalAbierto(true);
  }

  async function programar(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/quirofano/cirugias', form);
      setModalAbierto(false);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cambiarEstado(id, estado) {
    await api.patch(`/quirofano/cirugias/${id}/estado`, { estado });
    cargar();
  }

  return (
    <TarjetaSeccion titulo={`Cirugía General — ${cirugias.length} registradas`} acciones={<Boton onClick={abrirNuevo}>+ Programar Cirugía</Boton>}>
      {cirugias.length === 0 ? (
        <EstadoVacio texto="No hay cirugías programadas." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cirugias.map((c) => (
            <div key={c.id} className="tarjeta-estudio">
              <div style={{ flex: 1 }}>
                <p className="tarjeta-estudio__titulo">
                  {c.tipo_cirugia} {c.caracter === 'urgente' && <Badge tipo="peligro">Urgente</Badge>}
                </p>
                <p className="tarjeta-estudio__paciente">
                  {c.paciente_nombre} {c.paciente_apellido} · DNI: {c.paciente_dni}
                </p>
                {c.cirujano_nombre && <p className="tarjeta-estudio__meta">Dr./Dra. {c.cirujano_nombre} {c.cirujano_apellido}</p>}
                <p className="tarjeta-estudio__meta">{c.quirofano} · {c.fecha_programada} {c.hora_inicio}</p>
              </div>
              <select value={c.estado} onChange={(e) => cambiarEstado(c.id, e.target.value)}>
                <option value="programada">Programada</option>
                <option value="en_curso">En curso</option>
                <option value="finalizada">Finalizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          ))}
        </div>
      )}

      <Modal titulo="Programar Cirugía" abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} ancho={620}>
        <form onSubmit={programar}>
          <div className="formulario-grid">
            <Campo label="Paciente *" ancho={2}>
              <select required value={form.paciente_id} onChange={(e) => setForm({ ...form, paciente_id: e.target.value })}>
                <option value="">Seleccionar paciente…</option>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Tipo de cirugía *"><input required value={form.tipo_cirugia} onChange={(e) => setForm({ ...form, tipo_cirugia: e.target.value })} placeholder="Ej: Colecistectomía laparoscópica" /></Campo>
            <Campo label="Carácter">
              <select value={form.caracter} onChange={(e) => setForm({ ...form, caracter: e.target.value })}>
                <option value="programada">Programada</option>
                <option value="urgente">Urgente</option>
              </select>
            </Campo>
            <Campo label="Tipo de intervención">
              <select value={form.tipo_intervencion} onChange={(e) => setForm({ ...form, tipo_intervencion: e.target.value })}>
                <option value="ambulatoria">Ambulatoria</option>
                <option value="internacion">Con internación</option>
              </select>
            </Campo>
            <Campo label="Cirujano">
              <select value={form.cirujano_id} onChange={(e) => setForm({ ...form, cirujano_id: e.target.value })}>
                <option value="">Seleccionar…</option>
                {medicos.map((m) => <option key={m.id} value={m.id}>{m.nombre} {m.apellido}</option>)}
              </select>
            </Campo>
            <Campo label="Anestesiólogo"><input value={form.anestesiologo} onChange={(e) => setForm({ ...form, anestesiologo: e.target.value })} placeholder="Dr./Dra. …" /></Campo>
            <Campo label="Quirófano">
              <select value={form.quirofano} onChange={(e) => setForm({ ...form, quirofano: e.target.value })}>
                <option>Quirófano A</option>
                <option>Quirófano B</option>
              </select>
            </Campo>
            <Campo label="Fecha programada *"><input type="date" required value={form.fecha_programada} onChange={(e) => setForm({ ...form, fecha_programada: e.target.value })} /></Campo>
            <Campo label="Hora de inicio"><input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} /></Campo>
            <Campo label="Duración estimada"><input placeholder="Ej: 2 horas" value={form.duracion_estimada} onChange={(e) => setForm({ ...form, duracion_estimada: e.target.value })} /></Campo>
            <Campo label="Equipo quirúrgico" ancho={2}><input value={form.equipo_quirurgico} onChange={(e) => setForm({ ...form, equipo_quirurgico: e.target.value })} placeholder="Instrumentista, circulante…" /></Campo>
            <Campo label="Notas prequirúrgicas" ancho={2}><textarea rows={2} value={form.notas_prequirurgicas} onChange={(e) => setForm({ ...form, notas_prequirurgicas: e.target.value })} /></Campo>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton type="submit">Programar</Boton>
          </div>
        </form>
      </Modal>
    </TarjetaSeccion>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';
import { useActualizacionTiempoReal } from '../../hooks';

const TAGS_DISPONIBLES = ['Pérdida de conocimiento', 'Dolor torácico', 'Trauma', 'Sangrado activo', 'Dificultad respiratoria', 'Convulsiones', 'Fiebre', 'Fractura', 'Quemadura', 'Intoxicación'];
const TRIAGE = [
  { nivel: 1, label: 'Resucitación', color: '#c23b3b' },
  { nivel: 2, label: 'Emergencia', color: '#d98c2b' },
  { nivel: 3, label: 'Urgencia', color: '#d9a72b' },
  { nivel: 4, label: 'Urgencia Menor', color: '#4a94d1' },
  { nivel: 5, label: 'Sin Urgencia', color: '#2fa88c' },
];

export default function Guardia() {
  const [ingresos, setIngresos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [protocoloNN, setProtocoloNN] = useState(false);
  const [pacienteId, setPacienteId] = useState('');
  const [medioTransporte, setMedioTransporte] = useState('particular');
  const [acompNombre, setAcompNombre] = useState('');
  const [acompVinculo, setAcompVinculo] = useState('');
  const [nivelTriage, setNivelTriage] = useState(3);
  const [motivo, setMotivo] = useState('');
  const [signosVitales, setSignosVitales] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [tags, setTags] = useState([]);
  const [preOrden, setPreOrden] = useState(false);

  const cargar = useCallback(() => {
    api.get('/guardia').then(setIngresos).catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    api.get('/pacientes').then(setPacientes).catch(() => {});
    api.get('/pacientes/areas-derivacion').then(setAreas).catch(() => {});
  }, []);
  useActualizacionTiempoReal('guardia', cargar);

  function abrirNuevo() {
    setProtocoloNN(false); setPacienteId(''); setMedioTransporte('particular');
    setAcompNombre(''); setAcompVinculo(''); setNivelTriage(3); setMotivo('');
    setSignosVitales(''); setObservaciones(''); setTags([]); setPreOrden(false);
    setError('');
    setModalAbierto(true);
  }

  function toggleTag(tag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function registrarIngreso(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      await api.post('/guardia', {
        protocolo_nn: protocoloNN,
        paciente_id: protocoloNN ? null : pacienteId,
        nombre_temporal: protocoloNN ? 'Paciente NN' : undefined,
        medio_transporte: medioTransporte,
        acompanante_nombre: acompNombre,
        acompanante_vinculo: acompVinculo,
        nivel_triage: nivelTriage,
        motivo_consulta: motivo,
        signos_vitales: signosVitales,
        observaciones,
        tags,
        pre_orden_estudios: preOrden,
      });
      setModalAbierto(false);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function derivar(id, destino) {
    if (!destino) return;
    await api.patch(`/guardia/${id}/derivar`, { destino });
    cargar();
  }

  async function eliminarIngreso(id) {
    await api.delete(`/guardia/${id}`);
    cargar();
  }

  return (
    <TarjetaSeccion titulo="Guardia y Urgencias — Triage y derivación de pacientes" acciones={<Boton variante="peligro" onClick={abrirNuevo}>+ Nuevo Ingreso</Boton>}>
      {ingresos.length === 0 ? (
        <EstadoVacio texto="No hay pacientes en guardia en este momento." />
      ) : (
        <div className="lista-guardia">
          {ingresos.map((ing) => {
            const triage = TRIAGE.find((t) => t.nivel === ing.nivel_triage) || TRIAGE[2];
            return (
              <div key={ing.id} className="tarjeta-guardia">
                <div className="tarjeta-guardia__nivel" style={{ background: triage.color }}>{ing.nivel_triage}</div>
                <div className="tarjeta-guardia__cuerpo">
                  <p className="tarjeta-guardia__nombre">
                    {ing.protocolo_nn ? 'Paciente NN (no identificado)' : `${ing.paciente_nombre} ${ing.paciente_apellido}`}
                  </p>
                  <p className="tarjeta-guardia__triage">{triage.label} · {ing.motivo_consulta}</p>
                  {ing.tags?.length > 0 && (
                    <div className="tarjeta-guardia__tags">
                      {ing.tags.map((t) => <Badge key={t} tipo="peligro">{t}</Badge>)}
                    </div>
                  )}
                  <p className="tarjeta-guardia__meta">Transporte: {ing.medio_transporte} {ing.acompanante_nombre && `· Acomp: ${ing.acompanante_nombre}`}</p>
                </div>
                <div className="tarjeta-guardia__acciones">
                  <select defaultValue="" onChange={(e) => derivar(ing.id, e.target.value)}>
                    <option value="">Derivar a…</option>
                    {areas.map((a) => <option key={a.valor} value={a.valor}>{a.label}</option>)}
                  </select>
                  <button className="icono-boton icono-boton--peligro" title="Eliminar" onClick={() => eliminarIngreso(ing.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal titulo="Nuevo Ingreso a Guardia" abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} ancho={620}>
        <form onSubmit={registrarIngreso}>
          <label className="check-protocolo-nn">
            <input type="checkbox" checked={protocoloNN} onChange={(e) => setProtocoloNN(e.target.checked)} />
            Protocolo NN — Paciente no identificado
          </label>

          {!protocoloNN && (
            <Campo label="Paciente *">
              <select required={!protocoloNN} value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
                <option value="">Seleccionar paciente…</option>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre} — DNI {p.dni}</option>)}
              </select>
            </Campo>
          )}

          <div className="formulario-grid" style={{ marginTop: 14 }}>
            <Campo label="Medio de transporte">
              <select value={medioTransporte} onChange={(e) => setMedioTransporte(e.target.value)}>
                <option value="particular">Particular</option>
                <option value="ambulancia">Ambulancia</option>
                <option value="a_pie">A pie</option>
                <option value="policia">Policía</option>
                <option value="otro">Otro</option>
              </select>
            </Campo>
            <Campo label="Nombre del acompañante"><input value={acompNombre} onChange={(e) => setAcompNombre(e.target.value)} /></Campo>
            <Campo label="Vínculo del acompañante"><input placeholder="Ej: Hijo/a, Esposa" value={acompVinculo} onChange={(e) => setAcompVinculo(e.target.value)} /></Campo>
          </div>

          <p className="form-subtitulo">Nivel de Triage</p>
          <div className="triage-selector">
            {TRIAGE.map((t) => (
              <button
                type="button"
                key={t.nivel}
                className={`triage-selector__item ${nivelTriage === t.nivel ? 'triage-selector__item--activo' : ''}`}
                style={{ '--color-triage': t.color }}
                onClick={() => setNivelTriage(t.nivel)}
              >
                {t.nivel} — {t.label}
              </button>
            ))}
          </div>

          <div className="formulario-grid" style={{ marginTop: 14, gridTemplateColumns: '1fr' }}>
            <Campo label="Motivo de consulta *"><input required value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
            <Campo label="Signos vitales"><input placeholder="TA, FC, FR, T°" value={signosVitales} onChange={(e) => setSignosVitales(e.target.value)} /></Campo>
            <Campo label="Observaciones"><textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></Campo>
          </div>

          <p className="form-subtitulo">Tags rápidos de observación</p>
          <div className="tags-rapidos">
            {TAGS_DISPONIBLES.map((tag) => (
              <button
                type="button"
                key={tag}
                className={`tags-rapidos__item ${tags.includes(tag) ? 'tags-rapidos__item--activo' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          <label className="check-preorden">
            <input type="checkbox" checked={preOrden} onChange={(e) => setPreOrden(e.target.checked)} />
            Pre-orden de Estudios (Laboratorio básico) — notifica a Laboratorio al instante
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton variante="peligro" type="submit" disabled={guardando}>{guardando ? 'Registrando…' : 'Registrar Ingreso'}</Boton>
          </div>
        </form>
      </Modal>
    </TarjetaSeccion>
  );
}

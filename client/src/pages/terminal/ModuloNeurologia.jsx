import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';

export default function ModuloNeurologia({ paciente }) {
  const [seguimientos, setSeguimientos] = useState([]);
  const [sintomas, setSintomas] = useState('');
  const [escala, setEscala] = useState('');
  const [obs, setObs] = useState('');

  const [tipoImagen, setTipoImagen] = useState('Tomografía');
  const [enviandoUrgente, setEnviandoUrgente] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');

  const cargar = useCallback(() => {
    api.get(`/especialidades/neurologia/seguimientos/${paciente.id}`).then(setSeguimientos).catch(() => {});
  }, [paciente.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function agregarSeguimiento(e) {
    e.preventDefault();
    await api.post('/especialidades/neurologia/seguimientos', { paciente_id: paciente.id, sintomas, escala_progresion: escala, observaciones: obs });
    setSintomas(''); setEscala(''); setObs('');
    cargar();
  }

  async function solicitarImagenUrgente() {
    setEnviandoUrgente(true);
    try {
      await api.post('/imagenes', { paciente_id: paciente.id, tipo_estudio: tipoImagen, prioridad: 'urgente' });
      setConfirmacion(`Solicitud urgente de ${tipoImagen} enviada a Imágenes.`);
      setTimeout(() => setConfirmacion(''), 4000);
    } finally {
      setEnviandoUrgente(false);
    }
  }

  return (
    <div>
      <TarjetaSeccion titulo="Seguimiento de Enfermedades Neurodegenerativas">
        {seguimientos.length === 0 ? (
          <EstadoVacio texto="No hay seguimientos registrados." />
        ) : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Síntomas</th><th>Escala de progresión</th><th>Observaciones</th></tr></thead>
            <tbody>
              {seguimientos.map((s) => (
                <tr key={s.id}><td>{new Date(s.fecha).toLocaleDateString('es-AR')}</td><td>{s.sintomas || '—'}</td><td>{s.escala_progresion || '—'}</td><td>{s.observaciones || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={agregarSeguimiento} className="formulario-grid" style={{ marginTop: 16 }}>
          <Campo label="Síntomas actuales" ancho={2}><input value={sintomas} onChange={(e) => setSintomas(e.target.value)} /></Campo>
          <Campo label="Escala de progresión"><input placeholder="Ej: MMSE 24/30" value={escala} onChange={(e) => setEscala(e.target.value)} /></Campo>
          <Campo label="Observaciones" ancho={2}><textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
          <Boton type="submit">Registrar evolución</Boton>
        </form>
      </TarjetaSeccion>

      <TarjetaSeccion titulo="Solicitud Crítica de Estudios de Imagen">
        <p className="ayuda-campo" style={{ marginBottom: 14 }}>
          Genera una solicitud marcada con prioridad urgente, agilizando el circuito con Radiografía/Imágenes.
        </p>
        <div className="formulario-grid">
          <Campo label="Tipo de estudio">
            <select value={tipoImagen} onChange={(e) => setTipoImagen(e.target.value)}>
              <option>Tomografía cerebral</option>
              <option>Resonancia magnética cerebral</option>
              <option>Angiografía cerebral</option>
            </select>
          </Campo>
          <Boton variante="peligro" onClick={solicitarImagenUrgente} disabled={enviandoUrgente}>
            {enviandoUrgente ? 'Enviando…' : 'Solicitar con prioridad URGENTE'}
          </Boton>
        </div>
        {confirmacion && <Badge tipo="exito" style={{ marginTop: 12 }}>{confirmacion}</Badge>}
      </TarjetaSeccion>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';

export default function ModuloCardiologia({ paciente }) {
  const [marcapasos, setMarcapasos] = useState([]);
  const [ecgs, setEcgs] = useState([]);

  const [modeloMp, setModeloMp] = useState('');
  const [fechaMp, setFechaMp] = useState('');
  const [paramMp, setParamMp] = useState('');

  const [fechaEcg, setFechaEcg] = useState('');
  const [obsEcg, setObsEcg] = useState('');
  const [archivoEcg, setArchivoEcg] = useState(null);

  const cargar = useCallback(() => {
    api.get(`/especialidades/cardiologia/marcapasos/${paciente.id}`).then(setMarcapasos).catch(() => {});
    api.get(`/especialidades/cardiologia/ecg/${paciente.id}`).then(setEcgs).catch(() => {});
  }, [paciente.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function agregarMarcapasos(e) {
    e.preventDefault();
    await api.post('/especialidades/cardiologia/marcapasos', { paciente_id: paciente.id, modelo: modeloMp, fecha_implante: fechaMp, parametros: paramMp });
    setModeloMp(''); setFechaMp(''); setParamMp('');
    cargar();
  }

  async function agregarEcg(e) {
    e.preventDefault();
    await api.post('/especialidades/cardiologia/ecg', { paciente_id: paciente.id, fecha: fechaEcg, observaciones: obsEcg, archivo_nombre: archivoEcg?.name || null });
    setFechaEcg(''); setObsEcg(''); setArchivoEcg(null);
    cargar();
  }

  return (
    <div>
      <TarjetaSeccion titulo="Registro de Marcapasos">
        {marcapasos.length === 0 ? (
          <EstadoVacio texto="No hay marcapasos registrados." />
        ) : (
          <table className="tabla">
            <thead><tr><th>Modelo</th><th>Fecha de implante</th><th>Parámetros</th></tr></thead>
            <tbody>{marcapasos.map((m) => (<tr key={m.id}><td>{m.modelo}</td><td>{m.fecha_implante}</td><td>{m.parametros || '—'}</td></tr>))}</tbody>
          </table>
        )}
        <form onSubmit={agregarMarcapasos} className="formulario-grid" style={{ marginTop: 16 }}>
          <Campo label="Modelo del dispositivo"><input required value={modeloMp} onChange={(e) => setModeloMp(e.target.value)} /></Campo>
          <Campo label="Fecha de implante"><input type="date" required value={fechaMp} onChange={(e) => setFechaMp(e.target.value)} /></Campo>
          <Campo label="Parámetros" ancho={2}><input value={paramMp} onChange={(e) => setParamMp(e.target.value)} /></Campo>
          <Boton type="submit">Registrar marcapasos</Boton>
        </form>
      </TarjetaSeccion>

      <TarjetaSeccion titulo="Electrocardiogramas (ECG)">
        {ecgs.length === 0 ? (
          <EstadoVacio texto="No hay ECG cargados." />
        ) : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Observaciones</th><th>Archivo</th></tr></thead>
            <tbody>{ecgs.map((e) => (<tr key={e.id}><td>{e.fecha}</td><td>{e.observaciones || '—'}</td><td>{e.archivo_nombre || '—'}</td></tr>))}</tbody>
          </table>
        )}
        <form onSubmit={agregarEcg} className="formulario-grid" style={{ marginTop: 16 }}>
          <Campo label="Fecha"><input type="date" required value={fechaEcg} onChange={(e) => setFechaEcg(e.target.value)} /></Campo>
          <Campo label="Observaciones" ancho={2}><input value={obsEcg} onChange={(e) => setObsEcg(e.target.value)} /></Campo>
          <Campo label="Archivo del ECG"><input type="file" onChange={(e) => setArchivoEcg(e.target.files[0])} /></Campo>
          <Boton type="submit">Cargar ECG</Boton>
        </form>
      </TarjetaSeccion>
    </div>
  );
}

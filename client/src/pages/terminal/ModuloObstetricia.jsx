import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';

export default function ModuloObstetricia({ paciente }) {
  const [fum, setFum] = useState('');
  const [calculo, setCalculo] = useState(null);
  const [controles, setControles] = useState([]);
  const [ecografias, setEcografias] = useState([]);

  const [pesoControl, setPesoControl] = useState('');
  const [semanaControl, setSemanaControl] = useState('');
  const [obsControl, setObsControl] = useState('');

  const [fechaEco, setFechaEco] = useState('');
  const [semanaEco, setSemanaEco] = useState('');
  const [obsEco, setObsEco] = useState('');
  const [archivoEco, setArchivoEco] = useState(null);

  const cargar = useCallback(() => {
    api.get(`/especialidades/obstetricia/controles/${paciente.id}`).then(setControles).catch(() => {});
    api.get(`/especialidades/obstetricia/ecografias/${paciente.id}`).then(setEcografias).catch(() => {});
  }, [paciente.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function calcular() {
    if (!fum) return;
    const data = await api.get(`/especialidades/obstetricia/calculadora/${paciente.id}?fum=${fum}`);
    setCalculo(data);
  }

  async function agregarControl(e) {
    e.preventDefault();
    await api.post('/especialidades/obstetricia/controles', {
      paciente_id: paciente.id, fum, peso_kg: pesoControl ? Number(pesoControl) : null,
      semana_gestacion: semanaControl ? Number(semanaControl) : null, observaciones: obsControl,
    });
    setPesoControl(''); setSemanaControl(''); setObsControl('');
    cargar();
  }

  async function agregarEcografia(e) {
    e.preventDefault();
    await api.post('/especialidades/obstetricia/ecografias', {
      paciente_id: paciente.id, fecha: fechaEco, semana_gestacion: semanaEco ? Number(semanaEco) : null,
      observaciones: obsEco, archivo_nombre: archivoEco?.name || null,
    });
    setFechaEco(''); setSemanaEco(''); setObsEco(''); setArchivoEco(null);
    cargar();
  }

  const maxPeso = Math.max(...controles.map((c) => c.peso_kg || 0), 1);

  return (
    <div>
      <TarjetaSeccion titulo="Calculadora Gestacional">
        <div className="calc-gestacional">
          <Campo label="Fecha de Última Menstruación (FUM)">
            <input type="date" value={fum} onChange={(e) => setFum(e.target.value)} />
          </Campo>
          <Boton onClick={calcular} disabled={!fum}>Calcular</Boton>
        </div>
        {calculo && (
          <div className="calc-gestacional__resultado">
            <div><p className="calc-gestacional__label">Edad gestacional</p><p className="calc-gestacional__valor">{calculo.semanas}s {calculo.dias}d</p></div>
            <div><p className="calc-gestacional__label">Fecha probable de parto</p><p className="calc-gestacional__valor">{calculo.fechaProbableParto}</p></div>
          </div>
        )}
      </TarjetaSeccion>

      <TarjetaSeccion titulo="Control Prenatal — Evolución de peso">
        {controles.length === 0 ? (
          <EstadoVacio texto="No hay controles registrados." />
        ) : (
          <div className="grafico-peso">
            {controles.map((c, i) => (
              <div key={c.id} className="grafico-peso__barra-cont" title={`Semana ${c.semana_gestacion}: ${c.peso_kg}kg`}>
                <div className="grafico-peso__barra" style={{ height: `${((c.peso_kg || 0) / maxPeso) * 100}%` }} />
                <span className="grafico-peso__label">S{c.semana_gestacion}</span>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={agregarControl} className="formulario-grid" style={{ marginTop: 16 }}>
          <Campo label="Semana de gestación"><input type="number" value={semanaControl} onChange={(e) => setSemanaControl(e.target.value)} /></Campo>
          <Campo label="Peso (kg)"><input type="number" step="0.1" value={pesoControl} onChange={(e) => setPesoControl(e.target.value)} /></Campo>
          <Campo label="Observaciones" ancho={2}><input value={obsControl} onChange={(e) => setObsControl(e.target.value)} /></Campo>
          <Boton type="submit">Agregar control</Boton>
        </form>
      </TarjetaSeccion>

      <TarjetaSeccion titulo="Monitoreo Fetal — Ecografías">
        {ecografias.length === 0 ? (
          <EstadoVacio texto="No hay ecografías cargadas." />
        ) : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Semana</th><th>Observaciones</th><th>Archivo</th></tr></thead>
            <tbody>
              {ecografias.map((e) => (
                <tr key={e.id}><td>{e.fecha}</td><td>{e.semana_gestacion}</td><td>{e.observaciones || '—'}</td><td>{e.archivo_nombre || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={agregarEcografia} className="formulario-grid" style={{ marginTop: 16 }}>
          <Campo label="Fecha"><input type="date" required value={fechaEco} onChange={(e) => setFechaEco(e.target.value)} /></Campo>
          <Campo label="Semana de gestación"><input type="number" value={semanaEco} onChange={(e) => setSemanaEco(e.target.value)} /></Campo>
          <Campo label="Observaciones" ancho={2}><input value={obsEco} onChange={(e) => setObsEco(e.target.value)} /></Campo>
          <Campo label="Archivo adjunto"><input type="file" onChange={(e) => setArchivoEco(e.target.files[0])} /></Campo>
          <Boton type="submit">Cargar ecografía</Boton>
        </form>
      </TarjetaSeccion>
    </div>
  );
}

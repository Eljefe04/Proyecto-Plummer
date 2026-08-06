import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';

export default function ModuloPediatria({ paciente }) {
  const [vacunas, setVacunas] = useState([]);
  const [percentiles, setPercentiles] = useState([]);

  const [nombreVacuna, setNombreVacuna] = useState('');
  const [fechaAplic, setFechaAplic] = useState('');
  const [proximaDosis, setProximaDosis] = useState('');

  const [pesoP, setPesoP] = useState('');
  const [tallaP, setTallaP] = useState('');
  const [perimetroP, setPerimetroP] = useState('');
  const [edadP, setEdadP] = useState('');

  const cargar = useCallback(() => {
    api.get(`/especialidades/pediatria/vacunas/${paciente.id}`).then(setVacunas).catch(() => {});
    api.get(`/especialidades/pediatria/percentiles/${paciente.id}`).then(setPercentiles).catch(() => {});
  }, [paciente.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function agregarVacuna(e) {
    e.preventDefault();
    await api.post('/especialidades/pediatria/vacunas', { paciente_id: paciente.id, vacuna: nombreVacuna, fecha_aplicacion: fechaAplic, proxima_dosis: proximaDosis, estado: fechaAplic ? 'aplicada' : 'pendiente' });
    setNombreVacuna(''); setFechaAplic(''); setProximaDosis('');
    cargar();
  }

  async function agregarPercentil(e) {
    e.preventDefault();
    await api.post('/especialidades/pediatria/percentiles', {
      paciente_id: paciente.id, peso_kg: pesoP ? Number(pesoP) : null, talla_cm: tallaP ? Number(tallaP) : null,
      perimetro_cefalico_cm: perimetroP ? Number(perimetroP) : null, edad_meses: edadP ? Number(edadP) : null,
    });
    setPesoP(''); setTallaP(''); setPerimetroP(''); setEdadP('');
    cargar();
  }

  const maxPeso = Math.max(...percentiles.map((p) => p.peso_kg || 0), 1);

  return (
    <div>
      <TarjetaSeccion titulo="Calendario de Vacunas">
        {vacunas.length === 0 ? (
          <EstadoVacio texto="No hay vacunas registradas." />
        ) : (
          <table className="tabla">
            <thead><tr><th>Vacuna</th><th>Fecha de aplicación</th><th>Próxima dosis</th><th>Estado</th></tr></thead>
            <tbody>
              {vacunas.map((v) => (
                <tr key={v.id}>
                  <td>{v.vacuna}</td><td>{v.fecha_aplicacion || '—'}</td><td>{v.proxima_dosis || '—'}</td>
                  <td><Badge tipo={v.estado === 'aplicada' ? 'exito' : 'alerta'}>{v.estado}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={agregarVacuna} className="formulario-grid" style={{ marginTop: 16 }}>
          <Campo label="Vacuna" ancho={2}><input required value={nombreVacuna} onChange={(e) => setNombreVacuna(e.target.value)} /></Campo>
          <Campo label="Fecha de aplicación"><input type="date" value={fechaAplic} onChange={(e) => setFechaAplic(e.target.value)} /></Campo>
          <Campo label="Próxima dosis"><input type="date" value={proximaDosis} onChange={(e) => setProximaDosis(e.target.value)} /></Campo>
          <Boton type="submit">Registrar vacuna</Boton>
        </form>
      </TarjetaSeccion>

      <TarjetaSeccion titulo="Gráficos de Percentiles">
        {percentiles.length === 0 ? (
          <EstadoVacio texto="No hay mediciones registradas." />
        ) : (
          <div className="grafico-peso">
            {percentiles.map((p) => (
              <div key={p.id} className="grafico-peso__barra-cont" title={`${p.edad_meses}m: ${p.peso_kg}kg / ${p.talla_cm}cm`}>
                <div className="grafico-peso__barra" style={{ height: `${((p.peso_kg || 0) / maxPeso) * 100}%` }} />
                <span className="grafico-peso__label">{p.edad_meses}m</span>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={agregarPercentil} className="formulario-grid" style={{ marginTop: 16 }}>
          <Campo label="Edad (meses)"><input type="number" value={edadP} onChange={(e) => setEdadP(e.target.value)} /></Campo>
          <Campo label="Peso (kg)"><input type="number" step="0.1" value={pesoP} onChange={(e) => setPesoP(e.target.value)} /></Campo>
          <Campo label="Talla (cm)"><input type="number" step="0.1" value={tallaP} onChange={(e) => setTallaP(e.target.value)} /></Campo>
          <Campo label="Perímetro cefálico (cm)"><input type="number" step="0.1" value={perimetroP} onChange={(e) => setPerimetroP(e.target.value)} /></Campo>
          <Boton type="submit">Registrar medición</Boton>
        </form>
      </TarjetaSeccion>
    </div>
  );
}

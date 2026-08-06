import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import LayoutInterno from '../components/LayoutInterno';
import Modal from '../components/Modal';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../components/ui';
import { useActualizacionTiempoReal } from '../hooks';

const MENU = [{ titulo: 'Laboratorio', items: [{ to: '/laboratorio', label: 'Estudios y resultados', exact: true }] }];

export default function Laboratorio() {
  const [estudios, setEstudios] = useState([]);
  const [modalResultado, setModalResultado] = useState(null);
  const [resultado, setResultado] = useState('');

  const cargar = useCallback(() => {
    api.get('/laboratorio').then(setEstudios).catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal('estudios_laboratorio', cargar);

  async function guardarResultado(e) {
    e.preventDefault();
    await api.patch(`/laboratorio/${modalResultado.id}/resultado`, { resultado });
    setModalResultado(null);
    setResultado('');
    cargar();
  }

  const pendientes = estudios.filter((e) => e.estado === 'pendiente');
  const realizados = estudios.filter((e) => e.estado === 'realizado');

  return (
    <LayoutInterno titulo="Laboratorio Clínico" menu={MENU}>
      <TarjetaSeccion titulo={`Solicitudes Pendientes — ${pendientes.length}`}>
        {pendientes.length === 0 ? <EstadoVacio texto="No hay solicitudes pendientes." /> : (
          <div className="lista-estudios">
            {pendientes.map((e) => (
              <div key={e.id} className="tarjeta-estudio">
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p className="tarjeta-estudio__titulo">{e.estudios.join(', ')}</p>
                    {e.prioridad === 'urgente' && <Badge tipo="peligro">Urgente</Badge>}
                  </div>
                  <p className="tarjeta-estudio__paciente">{e.paciente_nombre} {e.paciente_apellido} · DNI: {e.paciente_dni}</p>
                  <p className="tarjeta-estudio__meta">Solicitado por {e.solicitado_por} · {e.creado_en}</p>
                  {e.indicaciones && <p className="tarjeta-estudio__meta">Indicaciones: {e.indicaciones}</p>}
                </div>
                <Boton tamano="sm" onClick={() => { setModalResultado(e); setResultado(''); }}>Cargar Resultado</Boton>
              </div>
            ))}
          </div>
        )}
      </TarjetaSeccion>

      <TarjetaSeccion titulo={`Realizados — ${realizados.length}`}>
        {realizados.length === 0 ? <EstadoVacio texto="No hay estudios realizados aún." /> : (
          <table className="tabla">
            <thead><tr><th>Paciente</th><th>Estudio</th><th>Resultado</th></tr></thead>
            <tbody>
              {realizados.map((e) => (
                <tr key={e.id}><td>{e.paciente_nombre} {e.paciente_apellido}</td><td>{e.estudios.join(', ')}</td><td>{e.resultado}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </TarjetaSeccion>

      <Modal titulo="Cargar Resultado del Estudio" abierto={!!modalResultado} onCerrar={() => setModalResultado(null)}>
        {modalResultado && (
          <form onSubmit={guardarResultado}>
            <p className="ayuda-campo" style={{ marginBottom: 12 }}>
              {modalResultado.paciente_nombre} {modalResultado.paciente_apellido} — {modalResultado.estudios.join(', ')}
            </p>
            <Campo label="Resultado del estudio">
              <textarea rows={5} required value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="Ingrese los resultados del estudio…" />
            </Campo>
            <div className="form-acciones">
              <Boton variante="secundario" type="button" onClick={() => setModalResultado(null)}>Cancelar</Boton>
              <Boton type="submit">Guardar Resultado</Boton>
            </div>
          </form>
        )}
      </Modal>
    </LayoutInterno>
  );
}

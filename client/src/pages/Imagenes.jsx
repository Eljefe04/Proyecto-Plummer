import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import LayoutInterno from '../components/LayoutInterno';
import Modal from '../components/Modal';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../components/ui';
import { useActualizacionTiempoReal } from '../hooks';

const MENU = [{ titulo: 'Imágenes', items: [{ to: '/imagenes', label: 'Estudios por imagen', exact: true }] }];

export default function Imagenes() {
  const [estudios, setEstudios] = useState([]);
  const [modalInforme, setModalInforme] = useState(null);
  const [informe, setInforme] = useState('');

  const cargar = useCallback(() => {
    api.get('/imagenes').then(setEstudios).catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal('estudios_imagenes', cargar);

  async function guardarInforme(e) {
    e.preventDefault();
    await api.patch(`/imagenes/${modalInforme.id}/informe`, { informe });
    setModalInforme(null);
    setInforme('');
    cargar();
  }

  const pendientes = estudios.filter((e) => e.estado === 'pendiente');
  const realizados = estudios.filter((e) => e.estado !== 'pendiente');

  return (
    <LayoutInterno titulo="Radiografía / Imágenes" menu={MENU}>
      <TarjetaSeccion titulo={`Solicitudes Pendientes — ${pendientes.length}`}>
        {pendientes.length === 0 ? <EstadoVacio texto="No hay solicitudes pendientes." /> : (
          <div className="lista-estudios">
            {pendientes.map((e) => (
              <div key={e.id} className="tarjeta-estudio">
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p className="tarjeta-estudio__titulo">{e.tipo_estudio}</p>
                    {e.prioridad === 'urgente' && <Badge tipo="peligro">Urgente</Badge>}
                  </div>
                  <p className="tarjeta-estudio__paciente">{e.paciente_nombre} {e.paciente_apellido} · DNI: {e.paciente_dni}</p>
                  <p className="tarjeta-estudio__meta">Solicitado por {e.solicitado_por} · {e.creado_en}</p>
                </div>
                <Boton tamano="sm" onClick={() => { setModalInforme(e); setInforme(''); }}>Cargar Informe</Boton>
              </div>
            ))}
          </div>
        )}
      </TarjetaSeccion>

      <TarjetaSeccion titulo={`Realizados — ${realizados.length}`}>
        {realizados.length === 0 ? <EstadoVacio texto="No hay estudios realizados aún." /> : (
          <table className="tabla">
            <thead><tr><th>Paciente</th><th>Estudio</th><th>Informe</th><th>Estado</th></tr></thead>
            <tbody>
              {realizados.map((e) => (
                <tr key={e.id}>
                  <td>{e.paciente_nombre} {e.paciente_apellido}</td><td>{e.tipo_estudio}</td><td>{e.informe}</td>
                  <td><Badge tipo={e.estado === 'entregado' ? 'exito' : 'info'}>{e.estado}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TarjetaSeccion>

      <Modal titulo="Cargar Informe" abierto={!!modalInforme} onCerrar={() => setModalInforme(null)}>
        {modalInforme && (
          <form onSubmit={guardarInforme}>
            <p className="ayuda-campo" style={{ marginBottom: 12 }}>{modalInforme.paciente_nombre} {modalInforme.paciente_apellido} — {modalInforme.tipo_estudio}</p>
            <Campo label="Informe">
              <textarea rows={5} required value={informe} onChange={(e) => setInforme(e.target.value)} />
            </Campo>
            <div className="form-acciones">
              <Boton variante="secundario" type="button" onClick={() => setModalInforme(null)}>Cancelar</Boton>
              <Boton type="submit">Guardar Informe</Boton>
            </div>
          </form>
        )}
      </Modal>
    </LayoutInterno>
  );
}

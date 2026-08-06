import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { TarjetaSeccion, EstadoVacio, Badge } from '../../components/ui';
import { useActualizacionTiempoReal } from '../../hooks';

export default function Dashboard() {
  const [datos, setDatos] = useState(null);

  const cargar = useCallback(() => {
    api.get('/dashboard').then(setDatos).catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal('turnos', cargar);
  useActualizacionTiempoReal('camas', cargar);
  useActualizacionTiempoReal('guardia', cargar);
  useActualizacionTiempoReal('medicamentos', cargar);

  if (!datos) return null;

  return (
    <div>
      <div className="grid-metricas grid-metricas--4">
        <div className="metrica-card">
          <p>Pacientes Registrados</p>
          <strong>{datos.pacientesRegistrados}</strong>
        </div>
        <div className="metrica-card metrica-card--info">
          <p>Turnos de Hoy</p>
          <strong>{datos.turnosHoy}</strong>
        </div>
        <div className="metrica-card">
          <p>Camas Ocupadas</p>
          <strong>{datos.camasOcupadas}</strong>
          <span>de {datos.camasTotales} totales</span>
        </div>
        <div className="metrica-card metrica-card--alerta">
          <p>Estudios Pendientes</p>
          <strong>{datos.estudiosPendientes}</strong>
        </div>
      </div>

      <TarjetaSeccion titulo="Alertas de Stock Bajo">
        {datos.alertasStock.length === 0 ? (
          <EstadoVacio texto="Todo el stock está dentro de los niveles normales." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {datos.alertasStock.map((m) => (
              <div key={m.nombre} className="fila-alerta-stock">
                <span>{m.nombre}</span>
                <span style={{ color: 'var(--plummer-ambar)', fontWeight: 700 }}>
                  Stock: {m.stock} / Mín: {m.stock_minimo}
                </span>
              </div>
            ))}
          </div>
        )}
      </TarjetaSeccion>

      <TarjetaSeccion titulo="Ingresos Recientes a Guardia">
        {datos.ingresosRecientesGuardia.length === 0 ? (
          <EstadoVacio texto="No hay ingresos recientes." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {datos.ingresosRecientesGuardia.map((g) => (
              <div key={g.id} className="fila-alerta-stock">
                <span>
                  <Badge tipo={g.nivel_triage <= 2 ? 'peligro' : 'alerta'}>{g.nivel_triage}</Badge>{' '}
                  {g.protocolo_nn ? 'Paciente NN' : `${g.paciente_nombre} ${g.paciente_apellido}`} — {g.motivo_consulta}
                </span>
                <span style={{ color: 'var(--texto-secundario)', fontSize: 12.5 }}>
                  {g.derivacion_destino || 'En guardia'}
                </span>
              </div>
            ))}
          </div>
        )}
      </TarjetaSeccion>
    </div>
  );
}

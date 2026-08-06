import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { TarjetaSeccion, EstadoVacio, Badge } from '../../components/ui';

const BADGE_ACCION = {
  creacion: 'exito',
  modificacion: 'info',
  eliminacion: 'peligro',
  acceso_hce: 'neutro',
  login: 'alerta',
};

export default function Auditoria() {
  const [resumen, setResumen] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');

  const cargar = useCallback(() => {
    const params = new URLSearchParams();
    if (busqueda) params.set('q', busqueda);
    if (filtroAccion) params.set('accion', filtroAccion);
    api.get(`/auditoria?${params.toString()}`).then(setRegistros).catch(() => {});
  }, [busqueda, filtroAccion]);

  useEffect(() => { api.get('/auditoria/resumen').then(setResumen).catch(() => {}); }, []);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <p style={{ color: 'var(--texto-secundario)', marginBottom: 18, fontSize: 13.5 }}>
        Trazabilidad de accesos y modificaciones — Ley 26.529
      </p>

      {resumen && (
        <div className="grid-metricas grid-metricas--4">
          <div className="metrica-card"><p>Total Registros</p><strong>{resumen.total}</strong></div>
          <div className="metrica-card metrica-card--exito"><p>Creaciones</p><strong>{resumen.creaciones}</strong></div>
          <div className="metrica-card metrica-card--info"><p>Modificaciones</p><strong>{resumen.modificaciones}</strong></div>
          <div className="metrica-card"><p>Accesos HCE</p><strong>{resumen.accesosHce}</strong></div>
        </div>
      )}

      <TarjetaSeccion titulo="Registro de Auditoría">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div className="buscador" style={{ flex: 1, marginBottom: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input placeholder="Buscar por usuario, descripción…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <select value={filtroAccion} onChange={(e) => setFiltroAccion(e.target.value)} style={{ padding: '10px 14px', border: '1.5px solid var(--borde-medio)', borderRadius: 'var(--radio-sm)' }}>
            <option value="">Todas las acciones</option>
            <option value="creacion">Creación</option>
            <option value="modificacion">Modificación</option>
            <option value="eliminacion">Eliminación</option>
            <option value="acceso_hce">Acceso HCE</option>
            <option value="login">Login</option>
          </select>
        </div>

        {registros.length === 0 ? (
          <EstadoVacio texto="No hay registros que coincidan con la búsqueda." />
        ) : (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Descripción</th></tr></thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{r.creado_en}</td>
                  <td>{r.usuario}</td>
                  <td><Badge tipo={BADGE_ACCION[r.accion] || 'neutro'}>{r.accion.replace('_', ' ')}</Badge></td>
                  <td style={{ textTransform: 'capitalize' }}>{r.modulo}</td>
                  <td style={{ fontSize: 13 }}>{r.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TarjetaSeccion>
    </div>
  );
}

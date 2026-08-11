import { useState, useEffect, useRef } from 'react';
import { useNotificacionesTiempoReal } from '../hooks';

function horaCorta(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Campana con contador, historial y toast.
 *
 * Se extrajo a componente propio porque la terminal medica NO usa
 * LayoutInterno (tiene su propia cabecera), y por eso era el unico
 * modulo del sistema que no recibia ninguna notificacion: ni turnos,
 * ni resultados de laboratorio, ni derivaciones. El medico trabajaba
 * a ciegas.
 */
export default function CampanaNotificaciones({ claro = false }) {
  const { notificaciones, sinLeer, marcarLeidas, toast, cerrarToast } = useNotificacionesTiempoReal();
  const [abierto, setAbierto] = useState(false);
  const [sacudiendo, setSacudiendo] = useState(false);
  const contenedor = useRef(null);
  const previo = useRef(0);

  useEffect(() => {
    if (sinLeer > previo.current) {
      setSacudiendo(true);
      const t = setTimeout(() => setSacudiendo(false), 650);
      previo.current = sinLeer;
      return () => clearTimeout(t);
    }
    previo.current = sinLeer;
  }, [sinLeer]);

  useEffect(() => {
    if (!abierto) return;
    function alClic(e) {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', alClic);
    return () => document.removeEventListener('mousedown', alClic);
  }, [abierto]);

  return (
    <div className={`campana-envoltorio ${claro ? 'campana-envoltorio--claro' : ''}`} ref={contenedor}>
      <button
        className={`campana ${sacudiendo ? 'campana--suena' : ''}`}
        onClick={() => {
          setAbierto((v) => !v);
          if (!abierto) marcarLeidas();
        }}
        aria-label={`Notificaciones${sinLeer ? ` (${sinLeer} sin leer)` : ''}`}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {sinLeer > 0 && <span className="campana__contador">{sinLeer > 9 ? '9+' : sinLeer}</span>}
      </button>

      {abierto && (
        <div className="panel-notificaciones">
          {notificaciones.length === 0 ? (
            <p className="panel-notificaciones__vacio">No hay notificaciones todavía.</p>
          ) : (
            notificaciones.map((n) => (
              <div
                key={n.id}
                className={`panel-notificaciones__item ${n.prioridad === 'urgente' ? 'panel-notificaciones__item--urgente' : ''}`}
              >
                <p className="panel-notificaciones__titulo">{n.titulo}</p>
                <p className="panel-notificaciones__mensaje">{n.mensaje}</p>
                <p className="panel-notificaciones__hora">{horaCorta(n.creado_en)}</p>
              </div>
            ))
          )}
        </div>
      )}

      {toast && (
        <div className={`layout__toast ${toast.prioridad === 'urgente' ? 'layout__toast--urgente' : ''}`} role="status">
          <div className="layout__toast-icono">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </div>
          <div>
            <p className="layout__toast-titulo">{toast.titulo}</p>
            <p className="layout__toast-mensaje">{toast.mensaje}</p>
          </div>
          <button className="layout__toast-cerrar" onClick={cerrarToast} aria-label="Cerrar notificación">×</button>
        </div>
      )}
    </div>
  );
}

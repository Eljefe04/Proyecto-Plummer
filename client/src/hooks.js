import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { api } from './api';
import { reproducirBeep } from './sonido';

/**
 * Notificaciones en vivo + historial persistido.
 * Devuelve tambien `sinLeer` y `marcarLeidas` para la campana.
 */
export function useNotificacionesTiempoReal() {
  const { socket } = useAuth();
  const [notificaciones, setNotificaciones] = useState([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  const cargarHistorico = useCallback(() => {
    api.get('/notificaciones').then(setNotificaciones).catch(() => {});
  }, []);

  useEffect(() => { cargarHistorico(); }, [cargarHistorico]);

  useEffect(() => {
    if (!socket) return;

    function onNotificacion(payload) {
      reproducirBeep(payload.prioridad === 'urgente' ? 'urgente' : 'normal');
      setNotificaciones((prev) => [payload, ...prev].slice(0, 50));
      setSinLeer((n) => n + 1);
      setToast(payload);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setToast(null), payload.prioridad === 'urgente' ? 12000 : 6000);
    }

    socket.on('notificacion', onNotificacion);
    return () => socket.off('notificacion', onNotificacion);
  }, [socket]);

  return {
    notificaciones,
    sinLeer,
    marcarLeidas: () => setSinLeer(0),
    toast,
    cerrarToast: () => setToast(null),
    recargar: cargarHistorico,
  };
}

/**
 * Escucha cambios de un recurso.
 *
 * FLUIDEZ: si el servidor manda los datos dentro del evento, se aplican
 * directo y no hace falta ningun pedido HTTP. Antes el evento solo decia
 * "cambio camas" y cada terminal disparaba un GET completo contra
 * Render -> Neon -> vuelta; ese viaje era el retraso que se notaba.
 *
 * Cuando el evento no trae datos, se recae en recargar, pero con un
 * pequeno agrupado para que varios eventos seguidos no disparen varios
 * pedidos iguales.
 *
 * @param {string|string[]} recursoEsperado
 * @param {Function} onActualizar  - recarga desde la API
 * @param {Function} [onDatos]     - aplica los datos que vienen en el evento
 */
export function useActualizacionTiempoReal(recursoEsperado, onActualizar, onDatos) {
  const { socket } = useAuth();
  const pendiente = useRef(null);
  const refRecargar = useRef(onActualizar);
  const refDatos = useRef(onDatos);

  refRecargar.current = onActualizar;
  refDatos.current = onDatos;

  useEffect(() => {
    if (!socket) return;
    const esperados = Array.isArray(recursoEsperado) ? recursoEsperado : [recursoEsperado];

    function onActualizacion(payload) {
      if (!esperados.includes(payload.recurso)) return;

      if (payload.datos && refDatos.current) {
        refDatos.current(payload.datos, payload.recurso);
        return;
      }

      clearTimeout(pendiente.current);
      pendiente.current = setTimeout(() => refRecargar.current(payload.recurso), 120);
    }

    socket.on('actualizar', onActualizacion);
    return () => {
      socket.off('actualizar', onActualizacion);
      clearTimeout(pendiente.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, Array.isArray(recursoEsperado) ? recursoEsperado.join(',') : recursoEsperado]);
}

/**
 * Marca una fila como recien actualizada durante unos segundos, para que
 * el cambio en vivo se VEA. Percibir el cambio hace que el sistema se
 * sienta mas rapido aunque tarde lo mismo.
 */
export function useDestelloActualizacion(ms = 2000) {
  const [destellando, setDestellando] = useState(() => new Set());

  const destellar = useCallback((id) => {
    setDestellando((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setDestellando((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }, ms);
  }, [ms]);

  return { destellando, destellar, claseDe: (id) => (destellando.has(id) ? 'fila--actualizada' : '') };
}

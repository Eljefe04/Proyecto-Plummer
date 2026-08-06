import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { api } from './api';
import { reproducirBeep } from './sonido';

export function useNotificacionesTiempoReal() {
  const { socket } = useAuth();
  const [notificaciones, setNotificaciones] = useState([]);
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  const cargarHistorico = useCallback(() => {
    api.get('/notificaciones').then(setNotificaciones).catch(() => {});
  }, []);

  useEffect(() => {
    cargarHistorico();
  }, [cargarHistorico]);

  useEffect(() => {
    if (!socket) return;

    function onNotificacion(payload) {
      reproducirBeep();
      setNotificaciones((prev) => [payload, ...prev].slice(0, 30));
      setToast(payload);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setToast(null), 6000);
    }

    socket.on('notificacion', onNotificacion);
    return () => socket.off('notificacion', onNotificacion);
  }, [socket]);

  return { notificaciones, toast, cerrarToast: () => setToast(null) };
}

export function useActualizacionTiempoReal(recursoEsperado, onActualizar) {
  const { socket } = useAuth();

  useEffect(() => {
    if (!socket) return;
    function onActualizacion(payload) {
      if (payload.recurso === recursoEsperado) onActualizar();
    }
    socket.on('actualizar', onActualizacion);
    return () => socket.off('actualizar', onActualizacion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, recursoEsperado]);
}

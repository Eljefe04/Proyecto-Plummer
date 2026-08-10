import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { api, registrarManejadorSesionVencida } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const guardado = sessionStorage.getItem('plummer_usuario');
    return guardado ? JSON.parse(guardado) : null;
  });
  const [socket, setSocket] = useState(null);
  const [avisoSesion, setAvisoSesion] = useState(null);
  const socketRef = useRef(null);

  const cerrarLocal = useCallback((mensaje = null) => {
    sessionStorage.removeItem('plummer_token');
    sessionStorage.removeItem('plummer_usuario');
    setUsuario(null);
    setAvisoSesion(mensaje);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocket(null);
  }, []);

  // Si el servidor reinicio y el token quedo muerto, salimos prolijamente
  // al login con un mensaje, en vez de dejar pantallas vacias.
  useEffect(() => {
    registrarManejadorSesionVencida(() =>
      cerrarLocal('Tu sesion se cerro porque el servidor se reinicio. Volve a entrar.')
    );
  }, [cerrarLocal]);

  const login = useCallback(async ({ rol, especialidad, usuario: user, password }) => {
    const data = await api.post('/auth/login', { rol, especialidad, usuario: user, password });
    sessionStorage.setItem('plummer_token', data.token);
    sessionStorage.setItem('plummer_usuario', JSON.stringify(data.usuario));
    setAvisoSesion(null);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // no bloquea el logout si la sesion ya vencio
    }
    cerrarLocal();
  }, [cerrarLocal]);

  useEffect(() => {
    if (!usuario) return;
    const token = sessionStorage.getItem('plummer_token');
    const socketUrl = import.meta.env.VITE_API_URL || '/';

    // FLUIDEZ: WebSocket primero. Por defecto socket.io arranca con
    // long-polling y recien despues intenta subir a WebSocket; si esa
    // subida no prospera detras del proxy de Render, cada evento queda
    // esperando el proximo ciclo de consulta y se nota el retraso.
    const s = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    });

    s.on('connect', () => s.emit('identificarse', token));
    // Si el servidor reinicio mientras estabamos conectados, al reconectar
    // nos volvemos a identificar solos.
    s.io.on('reconnect', () => s.emit('identificarse', token));
    s.on('sesion_invalida', () =>
      cerrarLocal('Tu sesion se cerro porque el servidor se reinicio. Volve a entrar.')
    );

    socketRef.current = s;
    setSocket(s);
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.nombreCompleto, usuario?.rol]);

  return (
    <AuthContext.Provider
      value={{ usuario, login, logout, socket, avisoSesion, limpiarAviso: () => setAvisoSesion(null) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

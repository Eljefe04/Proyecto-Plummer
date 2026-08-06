import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const guardado = sessionStorage.getItem('plummer_usuario');
    return guardado ? JSON.parse(guardado) : null;
  });
  const [socket, setSocket] = useState(null);

  const login = useCallback(async ({ rol, especialidad, usuario: user, password }) => {
    const data = await api.post('/auth/login', { rol, especialidad, usuario: user, password });
    sessionStorage.setItem('plummer_token', data.token);
    sessionStorage.setItem('plummer_usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // no bloquea el logout si la sesion ya expiro
    }
    sessionStorage.removeItem('plummer_token');
    sessionStorage.removeItem('plummer_usuario');
    setUsuario(null);
    if (socket) socket.disconnect();
    setSocket(null);
  }, [socket]);

  useEffect(() => {
    if (!usuario) return;
    const token = sessionStorage.getItem('plummer_token');
    // En desarrollo, io('/') se conecta al mismo origen (proxy de Vite).
    // En produccion, apunta directo al backend en Render via VITE_API_URL.
    const socketUrl = import.meta.env.VITE_API_URL || '/';
    const s = io(socketUrl, { path: '/socket.io' });
    s.on('connect', () => {
      s.emit('identificarse', token);
    });
    setSocket(s);
    return () => s.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.nombreCompleto]);

  return (
    <AuthContext.Provider value={{ usuario, login, logout, socket }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

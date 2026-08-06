import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Recepcion from './pages/Recepcion';
import Terminal from './pages/Terminal';
import Farmacia from './pages/Farmacia';
import Laboratorio from './pages/Laboratorio';
import Imagenes from './pages/Imagenes';
import Enfermeria from './pages/Enfermeria';
import Quirofano from './pages/Quirofano';
import Administrador from './pages/Administrador';

function RutaProtegida({ children }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/administrador/*" element={<RutaProtegida><Administrador /></RutaProtegida>} />
      <Route path="/recepcion/*" element={<RutaProtegida><Recepcion /></RutaProtegida>} />
      <Route path="/terminal" element={<RutaProtegida><Terminal /></RutaProtegida>} />
      <Route path="/enfermeria/*" element={<RutaProtegida><Enfermeria /></RutaProtegida>} />
      <Route path="/farmacia" element={<RutaProtegida><Farmacia /></RutaProtegida>} />
      <Route path="/laboratorio" element={<RutaProtegida><Laboratorio /></RutaProtegida>} />
      <Route path="/imagenes" element={<RutaProtegida><Imagenes /></RutaProtegida>} />
      <Route path="/quirofano/*" element={<RutaProtegida><Quirofano /></RutaProtegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

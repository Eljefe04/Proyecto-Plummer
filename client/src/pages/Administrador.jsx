import { Routes, Route, Navigate } from 'react-router-dom';
import LayoutInterno from '../components/LayoutInterno';
import Dashboard from './administrador/Dashboard';
import Auditoria from './administrador/Auditoria';
import Pacientes from './recepcion/Pacientes';
import Turnos from './recepcion/Turnos';
import Guardia from './recepcion/Guardia';
import Medicos from './recepcion/Medicos';
import PacientesInternados from './enfermeria/PacientesInternados';
import CamasEnfermeria from './enfermeria/CamasEnfermeria';

const MENU = [
  {
    titulo: 'Administrador',
    items: [
      { to: '/administrador/dashboard', label: 'Dashboard' },
      { to: '/administrador/auditoria', label: 'Auditoría' },
    ],
  },
  {
    titulo: 'Recepción / Admisión',
    items: [
      { to: '/administrador/pacientes', label: 'Pacientes' },
      { to: '/administrador/turnos', label: 'Turnos' },
      { to: '/administrador/guardia', label: 'Guardia' },
      { to: '/administrador/medicos', label: 'Médicos' },
    ],
  },
  {
    titulo: 'Internación',
    items: [
      { to: '/administrador/internacion', label: 'Pacientes Internados' },
      { to: '/administrador/camas', label: 'Camas' },
    ],
  },
];

export default function Administrador() {
  return (
    <LayoutInterno titulo="Panel de Administrador" menu={MENU}>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="pacientes" element={<Pacientes />} />
        <Route path="turnos" element={<Turnos />} />
        <Route path="guardia" element={<Guardia />} />
        <Route path="medicos" element={<Medicos />} />
        <Route path="internacion" element={<PacientesInternados />} />
        <Route path="camas" element={<CamasEnfermeria />} />
      </Routes>
    </LayoutInterno>
  );
}

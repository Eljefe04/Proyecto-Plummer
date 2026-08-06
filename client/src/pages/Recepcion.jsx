import { Routes, Route, Navigate } from 'react-router-dom';
import LayoutInterno from '../components/LayoutInterno';
import Pacientes from './recepcion/Pacientes';
import Turnos from './recepcion/Turnos';
import Guardia from './recepcion/Guardia';
import Medicos from './recepcion/Medicos';

const MENU = [
  {
    titulo: 'Recepción / Admisión',
    items: [
      { to: '/recepcion/pacientes', label: 'Pacientes' },
      { to: '/recepcion/turnos', label: 'Turnos' },
      { to: '/recepcion/guardia', label: 'Guardia' },
      { to: '/recepcion/medicos', label: 'Médicos' },
    ],
  },
];

export default function Recepcion() {
  return (
    <LayoutInterno titulo="Recepción / Admisión" menu={MENU}>
      <Routes>
        <Route index element={<Navigate to="pacientes" replace />} />
        <Route path="pacientes" element={<Pacientes />} />
        <Route path="turnos" element={<Turnos />} />
        <Route path="guardia" element={<Guardia />} />
        <Route path="medicos" element={<Medicos />} />
      </Routes>
    </LayoutInterno>
  );
}

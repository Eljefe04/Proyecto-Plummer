import { Routes, Route, Navigate } from 'react-router-dom';
import LayoutInterno from '../components/LayoutInterno';
import PacientesInternados from './enfermeria/PacientesInternados';
import CamasEnfermeria from './enfermeria/CamasEnfermeria';

const MENU = [
  {
    titulo: 'Enfermería',
    items: [
      { to: '/enfermeria/internacion', label: 'Internación / UTI' },
      { to: '/enfermeria/camas', label: 'Camas' },
    ],
  },
];

export default function Enfermeria() {
  return (
    <LayoutInterno titulo="Enfermería" menu={MENU}>
      <Routes>
        <Route index element={<Navigate to="internacion" replace />} />
        <Route path="internacion" element={<PacientesInternados />} />
        <Route path="camas" element={<CamasEnfermeria />} />
      </Routes>
    </LayoutInterno>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import LayoutInterno from '../components/LayoutInterno';
import PacientesInternados from './enfermeria/PacientesInternados';
import CamasEnfermeria from './enfermeria/CamasEnfermeria';
import DerivacionesEnfermeria from './enfermeria/Derivaciones';

const MENU = [
  {
    titulo: 'Enfermería',
    items: [
      { to: '/enfermeria/derivaciones', label: 'Derivaciones' },
      { to: '/enfermeria/internacion', label: 'Internación / UTI' },
      { to: '/enfermeria/camas', label: 'Camas' },
    ],
  },
];

export default function Enfermeria() {
  return (
    <LayoutInterno titulo="Enfermería" menu={MENU}>
      <Routes>
        <Route index element={<Navigate to="derivaciones" replace />} />
        <Route path="derivaciones" element={<DerivacionesEnfermeria />} />
        <Route path="internacion" element={<PacientesInternados />} />
        <Route path="camas" element={<CamasEnfermeria />} />
      </Routes>
    </LayoutInterno>
  );
}

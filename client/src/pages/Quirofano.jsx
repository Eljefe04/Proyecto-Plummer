import { Routes, Route, Navigate } from 'react-router-dom';
import LayoutInterno from '../components/LayoutInterno';
import Cirugia from './quirofano/Cirugia';
import Anestesiologia from './quirofano/Anestesiologia';

const MENU = [
  {
    titulo: 'Quirófano',
    items: [
      { to: '/quirofano/cirugia', label: 'Cirugía' },
      { to: '/quirofano/anestesiologia', label: 'Anestesiología' },
    ],
  },
];

export default function Quirofano() {
  return (
    <LayoutInterno titulo="Quirófano" menu={MENU}>
      <Routes>
        <Route index element={<Navigate to="cirugia" replace />} />
        <Route path="cirugia" element={<Cirugia />} />
        <Route path="anestesiologia" element={<Anestesiologia />} />
      </Routes>
    </LayoutInterno>
  );
}

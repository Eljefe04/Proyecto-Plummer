import { Routes, Route, Navigate } from 'react-router-dom';
import LayoutInterno from '../components/LayoutInterno';
import BandejaDerivaciones from '../components/BandejaDerivaciones';
import Cirugia from './quirofano/Cirugia';
import Anestesiologia from './quirofano/Anestesiologia';

const MENU = [
  {
    titulo: 'Quirófano',
    items: [
      { to: '/quirofano/derivaciones', label: 'Solicitudes recibidas' },
      { to: '/quirofano/cirugia', label: 'Cirugía' },
      { to: '/quirofano/anestesiologia', label: 'Anestesiología' },
    ],
  },
];

export default function Quirofano() {
  return (
    <LayoutInterno titulo="Quirófano" menu={MENU}>
      <Routes>
        <Route index element={<Navigate to="derivaciones" replace />} />

        <Route

          path="derivaciones"

          element={

            <BandejaDerivaciones

              destinos={['cirugia', 'anestesiologia']}

              titulo="Solicitudes recibidas"

              subtitulo="Pacientes derivados a Cirugía y Anestesiología"

            />

          }

        />
        <Route path="cirugia" element={<Cirugia />} />
        <Route path="anestesiologia" element={<Anestesiologia />} />
      </Routes>
    </LayoutInterno>
  );
}

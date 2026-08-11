import LayoutInterno from '../components/LayoutInterno';
import EstudiosLaboratorio from './laboratorio/EstudiosLaboratorio';

const MENU = [{
  titulo: 'Laboratorio',
  items: [{ to: '/laboratorio', label: 'Estudios y resultados', exact: true }],
}];

export default function Laboratorio() {
  return (
    <LayoutInterno titulo="Laboratorio Clínico" menu={MENU}>
      <EstudiosLaboratorio />
    </LayoutInterno>
  );
}

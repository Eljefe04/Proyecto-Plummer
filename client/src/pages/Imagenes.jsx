import LayoutInterno from '../components/LayoutInterno';
import EstudiosImagenes from './imagenes/EstudiosImagenes';

const MENU = [{
  titulo: 'Imágenes',
  items: [{ to: '/imagenes', label: 'Estudios por imágenes', exact: true }],
}];

export default function Imagenes() {
  return (
    <LayoutInterno titulo="Diagnóstico por Imágenes" menu={MENU}>
      <EstudiosImagenes />
    </LayoutInterno>
  );
}

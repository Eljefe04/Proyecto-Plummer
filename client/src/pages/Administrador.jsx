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
import DerivacionesEnfermeria from './enfermeria/Derivaciones';
import RecetasPendientes from './farmacia/RecetasPendientes';
import EstudiosLaboratorio from './laboratorio/EstudiosLaboratorio';
import EstudiosImagenes from './imagenes/EstudiosImagenes';
import Cirugia from './quirofano/Cirugia';
import Anestesiologia from './quirofano/Anestesiologia';

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
      { to: '/administrador/derivaciones', label: 'Derivaciones' },
      { to: '/administrador/internacion', label: 'Pacientes Internados' },
      { to: '/administrador/camas', label: 'Camas' },
    ],
  },
  {
    // El Administrador SUPERVISA todos los servicios: los ve enteros,
    // pero el acto medico (cargar un resultado, firmar un informe,
    // recetar, operar) sigue siendo del rol que corresponde. El servidor
    // rechaza esas escrituras aunque la pantalla se vea igual.
    titulo: 'Servicios (supervisión)',
    items: [
      { to: '/administrador/farmacia', label: 'Farmacia' },
      { to: '/administrador/laboratorio', label: 'Laboratorio' },
      { to: '/administrador/imagenes', label: 'Imágenes' },
      { to: '/administrador/cirugia', label: 'Cirugía' },
      { to: '/administrador/anestesiologia', label: 'Anestesiología' },
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
        <Route path="derivaciones" element={<DerivacionesEnfermeria />} />
        <Route path="farmacia" element={<RecetasPendientes />} />
        <Route path="laboratorio" element={<EstudiosLaboratorio />} />
        <Route path="imagenes" element={<EstudiosImagenes />} />
        <Route path="cirugia" element={<Cirugia />} />
        <Route path="anestesiologia" element={<Anestesiologia />} />
      </Routes>
    </LayoutInterno>
  );
}

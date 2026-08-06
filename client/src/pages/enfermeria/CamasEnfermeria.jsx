import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';
import { useActualizacionTiempoReal } from '../../hooks';

const SECTORES = [
  { valor: 'internacion', label: 'Internación' },
  { valor: 'terapia_intensiva', label: 'Terapia Intensiva' },
  { valor: 'guardia', label: 'Guardia' },
  { valor: 'quirofano', label: 'Quirófano' },
  { valor: 'recuperacion', label: 'Recuperación' },
];

const COLOR_ESTADO = { libre: '#2fa88c', ocupada: '#c23b3b', limpieza: '#d98c2b' };
const LABEL_ESTADO = { libre: 'Libre', ocupada: 'Ocupada', limpieza: 'En limpieza' };

export default function CamasEnfermeria() {
  const [camas, setCamas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [modalAsignar, setModalAsignar] = useState(null);
  const [pacienteId, setPacienteId] = useState('');

  const cargar = useCallback(() => {
    api.get('/camas').then(setCamas).catch(() => {});
  }, []);

  useEffect(() => { cargar(); api.get('/pacientes').then(setPacientes).catch(() => {}); }, [cargar]);
  useActualizacionTiempoReal('camas', cargar);

  async function asignar(e) {
    e.preventDefault();
    await api.patch(`/camas/${modalAsignar.id}/asignar`, { paciente_id: pacienteId });
    setModalAsignar(null);
    setPacienteId('');
    cargar();
  }

  async function liberar(cama) {
    await api.patch(`/camas/${cama.id}/liberar`);
    cargar();
  }

  async function marcarLibre(cama) {
    await api.patch(`/camas/${cama.id}/marcar-libre`);
    cargar();
  }

  const libres = camas.filter((c) => c.estado === 'libre').length;
  const ocupadas = camas.filter((c) => c.estado === 'ocupada').length;

  return (
    <TarjetaSeccion titulo={`Gestión de Camas — ${camas.length} camas · ${libres} libres · ${ocupadas} ocupadas`}>
      {SECTORES.map((sector) => {
        const camasSector = camas.filter((c) => c.sector === sector.valor);
        if (camasSector.length === 0) return null;
        return (
          <div key={sector.valor} style={{ marginBottom: 26 }}>
            <p className="form-subtitulo">{sector.label}</p>
            <div className="grid-camas">
              {camasSector.map((cama) => (
                <div key={cama.id} className="tarjeta-cama" style={{ '--color-cama': COLOR_ESTADO[cama.estado] }}>
                  <div className="tarjeta-cama__header">
                    <strong>{cama.codigo}</strong>
                    <span className="tarjeta-cama__punto" />
                  </div>
                  <p className="tarjeta-cama__estado">
                    {cama.estado === 'ocupada' && cama.paciente_nombre
                      ? `${cama.paciente_nombre} ${cama.paciente_apellido}`
                      : LABEL_ESTADO[cama.estado]}
                  </p>
                  {cama.estado === 'libre' && (
                    <Boton tamano="sm" onClick={() => { setModalAsignar(cama); setPacienteId(''); }}>Asignar</Boton>
                  )}
                  {cama.estado === 'ocupada' && (
                    <Boton tamano="sm" variante="secundario" onClick={() => liberar(cama)}>Liberar</Boton>
                  )}
                  {cama.estado === 'limpieza' && (
                    <Boton tamano="sm" variante="secundario" onClick={() => marcarLibre(cama)}>Marcar libre</Boton>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {camas.length === 0 && <EstadoVacio texto="No hay camas configuradas." />}

      <Modal titulo={`Asignar cama ${modalAsignar?.codigo || ''}`} abierto={!!modalAsignar} onCerrar={() => setModalAsignar(null)} ancho={420}>
        <form onSubmit={asignar}>
          <Campo label="Paciente">
            <select required value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
              <option value="">Seleccionar paciente…</option>
              {pacientes.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
            </select>
          </Campo>
          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalAsignar(null)}>Cancelar</Boton>
            <Boton type="submit">Asignar cama</Boton>
          </div>
        </form>
      </Modal>
    </TarjetaSeccion>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';
import { useActualizacionTiempoReal } from '../../hooks';

const VINCULOS = ['Padre', 'Madre', 'Cónyuge', 'Hijo/a', 'Hermano/a', 'Otro'];
const COBERTURAS = ['PAMI', 'IOSPER', 'OSDE', 'Otra'];

const PACIENTE_VACIO = {
  nombre: '', apellido: '', dni: '', cuil: '', fecha_nacimiento: '', genero: '', nacionalidad: 'Argentina',
  telefono: '', email: '', domicilio: '', localidad: '', provincia: '',
  tipo_cobertura: 'particular', cobertura_medica: '', numero_afiliado: '', vigencia_credencial: '', plan_cobertura: '',
  grupo_sanguineo: 'desconocido', factor_rh: 'desconocido', alergias: [], medicacion_habitual: '',
  antecedentes_patologicos: '', antecedentes_familiares: '',
  contacto_emergencia_nombre: '', contacto_emergencia_vinculo: '', contacto_emergencia_telefono: '',
  motivo_ingreso: '', derivacion_destino: '',
};

export default function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [areas, setAreas] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(null);
  const [confirmacionTexto, setConfirmacionTexto] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(PACIENTE_VACIO);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    api.get(`/pacientes${busqueda ? `?q=${encodeURIComponent(busqueda)}` : ''}`).then(setPacientes).catch(() => {});
  }, [busqueda]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { api.get('/pacientes/areas-derivacion').then(setAreas).catch(() => {}); }, []);
  useActualizacionTiempoReal('pacientes', cargar);

  function abrirNuevo() {
    setForm(PACIENTE_VACIO);
    setEditandoId(null);
    setError('');
    setModalAbierto(true);
  }

  function abrirEdicion(p) {
    setForm({ ...PACIENTE_VACIO, ...p, alergias: p.alergias || [] });
    setEditandoId(p.id);
    setError('');
    setModalAbierto(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);
    try {
      if (editandoId) {
        await api.put(`/pacientes/${editandoId}`, form);
      } else {
        await api.post('/pacientes', form);
      }
      setModalAbierto(false);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function darDeBaja(id) {
    await api.patch(`/pacientes/${id}/baja`);
    cargar();
  }

  async function eliminarDefinitivo() {
    if (confirmacionTexto !== 'ELIMINAR') return;
    await api.delete(`/pacientes/${modalEliminar.id}`);
    setModalEliminar(null);
    setConfirmacionTexto('');
    cargar();
  }

  const activos = pacientes.filter((p) => p.estado !== 'inactivo').length;

  return (
    <TarjetaSeccion
      titulo={`Gestión de Pacientes — ${activos} activos · ${pacientes.length} totales`}
      acciones={<Boton onClick={abrirNuevo}>+ Nuevo Paciente</Boton>}
    >
      <div className="buscador">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input placeholder="Buscar por nombre o DNI…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      {pacientes.length === 0 ? (
        <EstadoVacio texto="No hay pacientes cargados todavía." />
      ) : (
        <table className="tabla">
          <thead>
            <tr><th>Paciente</th><th>DNI</th><th>Cobertura</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {pacientes.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.apellido}, {p.nombre}</strong></td>
                <td>{p.dni}</td>
                <td>{p.tipo_cobertura === 'particular' ? 'Particular' : (p.cobertura_medica || '—')}</td>
                <td>
                  <Badge tipo={p.estado === 'internado' ? 'info' : p.estado === 'inactivo' ? 'neutro' : 'exito'}>
                    {p.estado}
                  </Badge>
                </td>
                <td>
                  <div className="tabla__acciones">
                    <button className="icono-boton" title="Editar" onClick={() => abrirEdicion(p)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                    {p.estado !== 'inactivo' && (
                      <button className="icono-boton" title="Dar de baja" onClick={() => darDeBaja(p.id)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg>
                      </button>
                    )}
                    <button className="icono-boton icono-boton--peligro" title="Eliminar definitivamente" onClick={() => { setModalEliminar(p); setConfirmacionTexto(''); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal titulo={editandoId ? 'Editar Paciente' : 'Nuevo Paciente'} abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} ancho={720}>
        <form onSubmit={guardar}>
          <p className="form-subtitulo">Datos Personales</p>
          <div className="formulario-grid">
            <Campo label="Nombre *"><input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Campo>
            <Campo label="Apellido *"><input required value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></Campo>
            <Campo label="DNI * (solo números)"><input required pattern="[0-9]+" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, '') })} /></Campo>
            <Campo label="CUIL (solo números)"><input pattern="[0-9]*" value={form.cuil} onChange={(e) => setForm({ ...form, cuil: e.target.value.replace(/\D/g, '') })} /></Campo>
            <Campo label="Fecha de nacimiento"><input type="date" value={form.fecha_nacimiento || ''} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} /></Campo>
            <Campo label="Género">
              <select value={form.genero || ''} onChange={(e) => setForm({ ...form, genero: e.target.value })}>
                <option value="">Seleccionar…</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            </Campo>
            <Campo label="Nacionalidad"><input value={form.nacionalidad} onChange={(e) => setForm({ ...form, nacionalidad: e.target.value })} /></Campo>
            <Campo label="Teléfono"><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Campo>
            <Campo label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo>
            <Campo label="Domicilio"><input value={form.domicilio} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} /></Campo>
            <Campo label="Localidad"><input value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} /></Campo>
            <Campo label="Provincia"><input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} /></Campo>
          </div>

          <p className="form-subtitulo">Cobertura Médica</p>
          <div className="formulario-grid">
            <Campo label="Tipo de cobertura">
              <select value={form.tipo_cobertura} onChange={(e) => setForm({ ...form, tipo_cobertura: e.target.value, cobertura_medica: e.target.value === 'particular' ? '' : form.cobertura_medica })}>
                <option value="particular">Particular</option>
                <option value="obra_social">Obra Social</option>
                <option value="prepaga">Prepaga</option>
              </select>
            </Campo>
            {form.tipo_cobertura !== 'particular' && (
              <>
                <Campo label="Cobertura médica">
                  <select value={form.cobertura_medica || ''} onChange={(e) => setForm({ ...form, cobertura_medica: e.target.value })}>
                    <option value="">Seleccionar…</option>
                    {COBERTURAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Campo>
                <Campo label="N° de afiliado"><input value={form.numero_afiliado} onChange={(e) => setForm({ ...form, numero_afiliado: e.target.value })} /></Campo>
                <Campo label="Vigencia de credencial"><input type="date" value={form.vigencia_credencial || ''} onChange={(e) => setForm({ ...form, vigencia_credencial: e.target.value })} /></Campo>
                <Campo label="Plan de cobertura"><input value={form.plan_cobertura} onChange={(e) => setForm({ ...form, plan_cobertura: e.target.value })} /></Campo>
              </>
            )}
          </div>

          <p className="form-subtitulo">Contacto de Emergencia</p>
          <div className="formulario-grid">
            <Campo label="Nombre completo"><input value={form.contacto_emergencia_nombre} onChange={(e) => setForm({ ...form, contacto_emergencia_nombre: e.target.value })} /></Campo>
            <Campo label="Vínculo">
              <select value={form.contacto_emergencia_vinculo || ''} onChange={(e) => setForm({ ...form, contacto_emergencia_vinculo: e.target.value })}>
                <option value="">Seleccionar…</option>
                {VINCULOS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Teléfono de emergencia"><input value={form.contacto_emergencia_telefono} onChange={(e) => setForm({ ...form, contacto_emergencia_telefono: e.target.value })} /></Campo>
          </div>

          <p className="form-subtitulo">Ingreso y Derivación</p>
          <div className="formulario-grid">
            <Campo label="Motivo de ingreso"><input value={form.motivo_ingreso} onChange={(e) => setForm({ ...form, motivo_ingreso: e.target.value })} /></Campo>
            <Campo label="Destino / Derivación">
              <select value={form.derivacion_destino || ''} onChange={(e) => setForm({ ...form, derivacion_destino: e.target.value })}>
                <option value="">Sin derivar</option>
                {areas.map((a) => <option key={a.valor} value={a.valor}>{a.label}</option>)}
              </select>
            </Campo>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton type="submit" disabled={guardando}>{guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear Paciente'}</Boton>
          </div>
        </form>
      </Modal>

      <Modal titulo="Eliminar paciente definitivamente" abierto={!!modalEliminar} onCerrar={() => setModalEliminar(null)} ancho={460}>
        {modalEliminar && (
          <div>
            <p className="modal-advertencia">
              Esta acción eliminará de forma permanente a <strong>{modalEliminar.nombre} {modalEliminar.apellido}</strong> y
              no se puede deshacer. Se recomienda usar <strong>Dar de baja</strong> en la mayoría de los casos para conservar el historial.
            </p>
            <Campo label='Para confirmar, escribí "ELIMINAR"'>
              <input value={confirmacionTexto} onChange={(e) => setConfirmacionTexto(e.target.value)} />
            </Campo>
            <div className="form-acciones">
              <Boton variante="secundario" onClick={() => setModalEliminar(null)}>Cancelar</Boton>
              <Boton variante="peligro" disabled={confirmacionTexto !== 'ELIMINAR'} onClick={eliminarDefinitivo}>Eliminar definitivamente</Boton>
            </div>
          </div>
        )}
      </Modal>
    </TarjetaSeccion>
  );
}

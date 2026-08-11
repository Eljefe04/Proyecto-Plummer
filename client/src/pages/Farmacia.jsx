import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from '../api';
import LayoutInterno from '../components/LayoutInterno';
import Modal from '../components/Modal';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../components/ui';
import { useActualizacionTiempoReal } from '../hooks';
import RecetasPendientes from './farmacia/RecetasPendientes';

const MENU = [{
  titulo: 'Farmacia',
  items: [
    { to: '/farmacia/recetas', label: 'Recetas pendientes' },
    { to: '/farmacia/inventario', label: 'Inventario y dispensación' },
  ],
}];

function Inventario() {
  const [medicamentos, setMedicamentos] = useState([]);
  const [dispensaciones, setDispensaciones] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [modalDispensar, setModalDispensar] = useState(false);
  const [modalAlta, setModalAlta] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(null);
  const [error, setError] = useState('');

  const [pacienteId, setPacienteId] = useState('');
  const [medicamentoId, setMedicamentoId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [indicaciones, setIndicaciones] = useState('');

  const [nombreNuevo, setNombreNuevo] = useState('');
  const [categoriaNueva, setCategoriaNueva] = useState('Otros');
  const [vencimientoNuevo, setVencimientoNuevo] = useState('');
  const [stockNuevo, setStockNuevo] = useState(0);
  const [stockMinNuevo, setStockMinNuevo] = useState(20);

  const cargar = useCallback(() => {
    api.get('/farmacia/medicamentos').then(setMedicamentos).catch(() => {});
    api.get('/farmacia/dispensaciones').then(setDispensaciones).catch(() => {});
  }, []);

  useEffect(() => { cargar(); api.get('/pacientes').then(setPacientes).catch(() => {}); }, [cargar]);
  useActualizacionTiempoReal('medicamentos', cargar);

  const hoy = new Date().toISOString().slice(0, 10);
  const vencidos = medicamentos.filter((m) => m.vencimiento < hoy);
  const stockBajo = medicamentos.filter((m) => m.stock < m.stock_minimo);
  const porVencer = medicamentos.filter((m) => {
    const dias = (new Date(m.vencimiento) - new Date(hoy)) / 86400000;
    return dias >= 0 && dias <= 30;
  });

  async function dispensar(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/farmacia/dispensar', { paciente_id: pacienteId, medicamento_id: medicamentoId, cantidad: Number(cantidad), indicaciones });
      setModalDispensar(false);
      setPacienteId(''); setMedicamentoId(''); setCantidad(1); setIndicaciones('');
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function altaMedicamento(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/farmacia/medicamentos', { nombre: nombreNuevo, categoria: categoriaNueva, vencimiento: vencimientoNuevo, stock: Number(stockNuevo), stock_minimo: Number(stockMinNuevo) });
      setModalAlta(false);
      setNombreNuevo(''); setVencimientoNuevo(''); setStockNuevo(0);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminarMedicamento() {
    await api.delete(`/farmacia/medicamentos/${modalEliminar.id}`);
    setModalEliminar(null);
    cargar();
  }

  return (
    <>
      <div className="grid-metricas">
        <div className="metrica-card metrica-card--alerta"><p>Stock Bajo</p><strong>{stockBajo.length}</strong><span>medicamentos bajo el mínimo</span></div>
        <div className="metrica-card metrica-card--info"><p>Por Vencer</p><strong>{porVencer.length}</strong><span>vencen en 30 días</span></div>
        <div className="metrica-card metrica-card--peligro"><p>Vencidos</p><strong>{vencidos.length}</strong><span>medicamentos vencidos</span></div>
      </div>

      <TarjetaSeccion
        titulo={`Inventario — ${medicamentos.length} medicamentos`}
        acciones={<>
          <Boton variante="exito" onClick={() => setModalDispensar(true)}>+ Dispensar</Boton>
          <Boton onClick={() => setModalAlta(true)} style={{ marginLeft: 8 }}>+ Cargar Stock</Boton>
        </>}
      >
        {medicamentos.length === 0 ? <EstadoVacio texto="No hay medicamentos cargados." /> : (
          <table className="tabla">
            <thead><tr><th>Medicamento</th><th>Vencimiento</th><th>Stock</th><th></th></tr></thead>
            <tbody>
              {medicamentos.map((m) => {
                const esVencido = m.vencimiento < hoy;
                const esBajo = m.stock < m.stock_minimo;
                return (
                  <tr key={m.id}>
                    <td><strong>{m.nombre}</strong><br /><span style={{ fontSize: 12, color: 'var(--texto-secundario)' }}>{m.categoria}</span></td>
                    <td style={{ color: esVencido ? 'var(--plummer-rojo-alerta)' : undefined }}>{m.vencimiento}</td>
                    <td style={{ color: esBajo ? 'var(--plummer-ambar)' : undefined, fontWeight: 700 }}>{m.stock}</td>
                    <td>
                      <div className="tabla__acciones">
                        {esVencido && (
                          <button className="icono-boton icono-boton--peligro" title="Eliminar vencido" onClick={() => setModalEliminar(m)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </TarjetaSeccion>

      <TarjetaSeccion titulo="Dispensaciones Recientes">
        {dispensaciones.length === 0 ? <EstadoVacio texto="No hay dispensaciones registradas." /> : (
          <table className="tabla">
            <thead><tr><th>Paciente</th><th>Medicamento</th><th>Cantidad</th><th>Fecha</th></tr></thead>
            <tbody>
              {dispensaciones.map((d) => (
                <tr key={d.id}><td>{d.paciente_apellido}, {d.paciente_nombre}</td><td>{d.medicamento_nombre}</td><td>{d.cantidad}</td><td>{d.creado_en}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </TarjetaSeccion>

      <Modal titulo="Dispensar Medicamento" abierto={modalDispensar} onCerrar={() => setModalDispensar(false)}>
        <form onSubmit={dispensar}>
          <div className="formulario-grid" style={{ gridTemplateColumns: '1fr' }}>
            <Campo label="Paciente *">
              <select required value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
                <option value="">Seleccionar paciente…</option>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Medicamento *">
              <select required value={medicamentoId} onChange={(e) => setMedicamentoId(e.target.value)}>
                <option value="">Seleccionar medicamento…</option>
                {medicamentos.map((m) => <option key={m.id} value={m.id}>{m.nombre} (stock: {m.stock})</option>)}
              </select>
            </Campo>
            <Campo label="Cantidad *"><input type="number" min={1} required value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></Campo>
            <Campo label="Indicaciones"><input value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} /></Campo>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalDispensar(false)}>Cancelar</Boton>
            <Boton variante="exito" type="submit">Dispensar</Boton>
          </div>
        </form>
      </Modal>

      <Modal titulo="Cargar Stock / Nuevo Producto" abierto={modalAlta} onCerrar={() => setModalAlta(false)}>
        <form onSubmit={altaMedicamento}>
          <div className="formulario-grid">
            <Campo label="Nombre *" ancho={2}><input required value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} /></Campo>
            <Campo label="Categoría">
              <select value={categoriaNueva} onChange={(e) => setCategoriaNueva(e.target.value)}>
                <option>Analgésico</option><option>Antiinflamatorio</option><option>Antibiótico</option><option>Antihipertensivo</option><option>Otros</option>
              </select>
            </Campo>
            <Campo label="Vencimiento *"><input type="date" required value={vencimientoNuevo} onChange={(e) => setVencimientoNuevo(e.target.value)} /></Campo>
            <Campo label="Stock inicial"><input type="number" min={0} value={stockNuevo} onChange={(e) => setStockNuevo(e.target.value)} /></Campo>
            <Campo label="Stock mínimo"><input type="number" min={0} value={stockMinNuevo} onChange={(e) => setStockMinNuevo(e.target.value)} /></Campo>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalAlta(false)}>Cancelar</Boton>
            <Boton type="submit">Cargar producto</Boton>
          </div>
        </form>
      </Modal>

      <Modal titulo="Eliminar medicamento" abierto={!!modalEliminar} onCerrar={() => setModalEliminar(null)} ancho={420}>
        {modalEliminar && (
          <div>
            <p className="modal-advertencia">Se eliminará <strong>{modalEliminar.nombre}</strong> del inventario de forma permanente.</p>
            <div className="form-acciones">
              <Boton variante="secundario" onClick={() => setModalEliminar(null)}>Cancelar</Boton>
              <Boton variante="peligro" onClick={eliminarMedicamento}>Eliminar definitivamente</Boton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// Contenedor del módulo: la bandeja de recetas es lo primero que se ve,
// porque es de donde tiene que salir toda dispensación.
export default function Farmacia() {
  return (
    <LayoutInterno titulo="Farmacia y Gestión de Stock" menu={MENU}>
      <Routes>
        <Route index element={<Navigate to="recetas" replace />} />
        <Route path="recetas" element={<RecetasPendientes />} />
        <Route path="inventario" element={<Inventario />} />
      </Routes>
    </LayoutInterno>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';
import { useActualizacionTiempoReal, useDestelloActualizacion } from '../../hooks';

function cuandoFue(iso) {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-AR');
}

/**
 * Bandeja de recetas pendientes.
 *
 * Antes Farmacia NUNCA consultaba las recetas: la pantalla solo cargaba
 * el inventario y las dispensaciones. La notificación de receta nueva
 * llegaba como aviso de seis segundos y se perdía. Se dispensaba a mano
 * eligiendo paciente y medicamento sueltos, sin relación con lo recetado.
 */
export default function RecetasPendientes() {
  const [recetas, setRecetas] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [dispensando, setDispensando] = useState(null);
  const [medicamentoId, setMedicamentoId] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const { destellar, claseDe } = useDestelloActualizacion();

  const cargar = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([
        api.get('/recetas/pendientes'),
        api.get('/farmacia/medicamentos'),
      ]);
      setRecetas(r);
      setMedicamentos(m);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal(['recetas', 'medicamentos'], cargar);

  function abrirDispensar(receta) {
    setDispensando(receta);
    setError('');
    setExito('');
    // Si el médico recetó eligiendo del inventario, viene preseleccionado.
    // Si no, se busca por nombre para ahorrarle el trabajo al farmacéutico.
    const porEnlace = receta.medicamento_id;
    const porNombre = medicamentos.find((m) =>
      m.nombre.toLowerCase().includes(String(receta.medicamento).toLowerCase().split(' ')[0])
    );
    setMedicamentoId(porEnlace || (porNombre ? porNombre.id : ''));
    setCantidad(1);
  }

  async function confirmar(e) {
    e.preventDefault();
    setError('');
    try {
      const r = await api.post('/farmacia/dispensar', {
        receta_id: dispensando.id,
        medicamento_id: medicamentoId,
        cantidad: Number(cantidad),
        indicaciones: dispensando.indicaciones || null,
      });
      destellar(dispensando.id);
      setExito(
        `Entregado a ${dispensando.paciente_apellido}, ${dispensando.paciente_nombre}. ` +
        `Stock restante: ${r.stock_restante}.`
      );
      setDispensando(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const seleccionado = medicamentos.find((m) => m.id === medicamentoId);
  const alergias = dispensando?.paciente_alergias;

  return (
    <div className="pila-secciones">
      {error && !dispensando && <div className="aviso-error">{error}</div>}
      {exito && <div className="aviso-exito">{exito}</div>}

      <TarjetaSeccion
        titulo="Recetas pendientes"
        subtitulo="Recetas digitales emitidas por los médicos, esperando dispensación"
        acciones={
          recetas.length > 0 && (
            <span className="estado-chip estado-chip--pendiente">{recetas.length} sin dispensar</span>
          )
        }
      >
        {recetas.length === 0 ? (
          <EstadoVacio texto="No hay recetas pendientes." />
        ) : (
          <div className="lista-derivaciones">
            {recetas.map((r) => (
              <article key={r.id} className={`tarjeta-derivacion surgir ${claseDe(r.id)}`}>
                <div className="tarjeta-derivacion__cabecera">
                  <div>
                    <p className="tarjeta-derivacion__paciente">
                      {r.paciente_apellido}, {r.paciente_nombre}
                    </p>
                    <p className="tarjeta-derivacion__meta">
                      DNI {r.paciente_dni} · Dr. {r.medico_apellido} ({r.medico_especialidad}) ·{' '}
                      {cuandoFue(r.creado_en)}
                    </p>
                  </div>
                  <span className="estado-chip estado-chip--pendiente">Pendiente</span>
                </div>

                <div className="receta-detalle">
                  <p className="receta-detalle__medicamento">{r.medicamento}</p>
                  <p className="receta-detalle__pauta">
                    {[r.dosis, r.frecuencia, r.via_administracion, r.duracion_tratamiento]
                      .filter(Boolean)
                      .join(' · ') || 'Sin pauta especificada'}
                  </p>
                  {r.indicaciones && (
                    <p className="receta-detalle__indicaciones">{r.indicaciones}</p>
                  )}
                </div>

                {r.paciente_alergias && (
                  <p className="aviso-alergia">Alergias registradas: {r.paciente_alergias}</p>
                )}

                <div className="tarjeta-derivacion__pie">
                  {r.inventario_nombre ? (
                    <span
                      className={`estado-chip estado-chip--${r.inventario_stock > 0 ? 'libre' : 'urgente'}`}
                    >
                      {r.inventario_nombre} · stock {r.inventario_stock}
                    </span>
                  ) : (
                    <span className="estado-chip estado-chip--inactivo">Sin enlace al inventario</span>
                  )}
                  <Boton onClick={() => abrirDispensar(r)}>Dispensar</Boton>
                </div>
              </article>
            ))}
          </div>
        )}
      </TarjetaSeccion>

      {dispensando && (
        <Modal
          abierto
          titulo="Dispensar receta"
          onCerrar={() => setDispensando(null)}
        >
          <form onSubmit={confirmar} className="formulario">
            {error && <div className="aviso-error">{error}</div>}

            {/* El paciente NO se elige: lo fija la receta, y el servidor
                lo valida de nuevo. Solo puede entregarse a esta persona. */}
            <div className="receta-fijada">
              <p className="receta-fijada__label">Paciente indicado en la receta</p>
              <p className="receta-fijada__valor">
                {dispensando.paciente_apellido}, {dispensando.paciente_nombre}
              </p>
              <p className="receta-fijada__meta">
                DNI {dispensando.paciente_dni} · recetado por Dr. {dispensando.medico_apellido}
              </p>
            </div>

            {alergias && <div className="aviso-alergia">Alergias registradas: {alergias}</div>}

            <div className="receta-fijada">
              <p className="receta-fijada__label">Medicamento recetado</p>
              <p className="receta-fijada__valor">{dispensando.medicamento}</p>
              <p className="receta-fijada__meta">
                {[dispensando.dosis, dispensando.frecuencia, dispensando.duracion_tratamiento]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            <Campo label="Producto del inventario a entregar">
              <select value={medicamentoId} onChange={(e) => setMedicamentoId(e.target.value)} required>
                <option value="">Seleccionar…</option>
                {medicamentos.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.stock <= 0}>
                    {m.nombre} {m.categoria ? `· ${m.categoria}` : ''} — stock {m.stock}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Cantidad a entregar">
              <input
                type="number"
                min="1"
                max={seleccionado ? seleccionado.stock : undefined}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                required
              />
            </Campo>

            {seleccionado && Number(cantidad) > seleccionado.stock && (
              <p className="aviso-error">
                Solo quedan {seleccionado.stock} unidades de {seleccionado.nombre}.
              </p>
            )}

            <div className="formulario__acciones">
              <Boton variante="secundario" type="button" onClick={() => setDispensando(null)}>
                Cancelar
              </Boton>
              <Boton
                type="submit"
                disabled={!medicamentoId || (seleccionado && Number(cantidad) > seleccionado.stock)}
              >
                Confirmar entrega
              </Boton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

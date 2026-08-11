import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { Boton, TarjetaSeccion, EstadoVacio, Campo } from './ui';
import Modal from './Modal';
import { useActualizacionTiempoReal, useDestelloActualizacion } from '../hooks';

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
 * Bandeja de derivaciones RECIBIDAS.
 *
 * Mismo mecanismo que la de Enfermería, para que el sistema se use igual
 * en todos lados: llega una derivación, aparece acá, se marca atendida.
 *
 * @param {string[]} destinos  destinos que corresponden a este módulo
 * @param {string}   titulo
 */
export default function BandejaDerivaciones({
  destinos,
  titulo = 'Derivaciones recibidas',
  subtitulo,
  onSeleccionar,
}) {
  const [derivaciones, setDerivaciones] = useState([]);
  const [error, setError] = useState('');
  const [camas, setCamas] = useState([]);
  const [asignando, setAsignando] = useState(null); // derivación sin cama
  const [camaElegida, setCamaElegida] = useState('');
  const { destellar, claseDe } = useDestelloActualizacion();

  const cargar = useCallback(async () => {
    try {
      const listas = await Promise.all(
        destinos.map((d) => api.get(`/derivaciones?destino=${d}`).catch(() => []))
      );
      const todas = listas.flat().sort((a, b) => {
        if ((a.prioridad === 'urgente') !== (b.prioridad === 'urgente')) {
          return a.prioridad === 'urgente' ? -1 : 1;
        }
        return new Date(b.creado_en) - new Date(a.creado_en);
      });
      setDerivaciones(todas);
      const c = await api.get('/camas').catch(() => []);
      setCamas(c);
      setError('');
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinos.join(',')]);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal(['derivaciones', 'guardia'], cargar);

  // Asignación manual: hace falta cuando el sector estaba completo al
  // momento de derivar y la derivación quedó registrada sin cama.
  async function confirmarCama(e) {
    e.preventDefault();
    setError('');
    try {
      await api.patch(`/camas/${camaElegida}/asignar`, { paciente_id: asignando.paciente_id });
      setAsignando(null);
      setCamaElegida('');
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function atender(id) {
    setError('');
    try {
      await api.patch(`/derivaciones/${id}/atender`);
      destellar(id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const camasDisponibles = camas.filter((c) => c.estado === 'libre');
  const sinCama = derivaciones.filter((d) => d.estado !== 'atendida' && !d.cama_codigo);
  const pendientes = derivaciones.filter((d) => d.estado !== 'atendida');
  const atendidas = derivaciones.filter((d) => d.estado === 'atendida');

  return (
    <div className="pila-secciones">
      {error && <div className="aviso-error">{error}</div>}

      {sinCama.length > 0 && (
        <div className="aviso-atencion">
          <strong>{sinCama.length} paciente{sinCama.length > 1 ? 's' : ''} sin cama.</strong>{' '}
          {camasDisponibles.length === 0
            ? 'No hay camas libres: liberá una desde Camas o dá de alta camas nuevas.'
            : `Hay ${camasDisponibles.length} cama${camasDisponibles.length > 1 ? 's' : ''} disponible${camasDisponibles.length > 1 ? 's' : ''}. Usá "Asignar cama" en la tarjeta.`}
        </div>
      )}

      <TarjetaSeccion
        titulo={titulo}
        subtitulo={subtitulo}
        acciones={
          pendientes.length > 0 && (
            <span className="estado-chip estado-chip--pendiente">
              {pendientes.length} sin atender
            </span>
          )
        }
      >
        {pendientes.length === 0 ? (
          <EstadoVacio texto="No hay derivaciones pendientes." />
        ) : (
          <div className="lista-derivaciones">
            {pendientes.map((d) => (
              <article
                key={d.id}
                className={`tarjeta-derivacion surgir ${claseDe(d.id)} ${
                  d.prioridad === 'urgente' ? 'tarjeta-derivacion--urgente' : ''
                }`}
              >
                <div className="tarjeta-derivacion__cabecera">
                  <div>
                    <p className="tarjeta-derivacion__paciente">
                      {d.paciente_apellido}, {d.paciente_nombre}
                    </p>
                    <p className="tarjeta-derivacion__meta">
                      DNI {d.paciente_dni} · desde <strong>{d.origen}</strong> · {cuandoFue(d.creado_en)}
                      {d.derivado_por ? ` · ${d.derivado_por}` : ''}
                    </p>
                  </div>
                  <span
                    className={`estado-chip estado-chip--${d.prioridad === 'urgente' ? 'urgente' : 'curso'}`}
                  >
                    {d.prioridad === 'urgente' ? 'Urgente' : String(d.destino).replace('_', ' ')}
                  </span>
                </div>

                {d.motivo && <p className="tarjeta-derivacion__motivo">{d.motivo}</p>}

                <div className="tarjeta-derivacion__pie">
                  {d.cama_codigo ? (
                    <span className="estado-chip estado-chip--libre">
                      Cama {d.cama_codigo} · {String(d.cama_sector).replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="estado-chip estado-chip--pendiente">Sin cama asignada</span>
                  )}
                  <div className="tarjeta-derivacion__botones">
                    {!d.cama_codigo && (
                      <Boton
                        variante="secundario"
                        onClick={() => { setAsignando(d); setCamaElegida(''); }}
                      >
                        Asignar cama
                      </Boton>
                    )}
                    {onSeleccionar && (
                      <Boton
                        variante="secundario"
                        onClick={() =>
                          onSeleccionar({
                            id: d.paciente_id,
                            nombre: d.paciente_nombre,
                            apellido: d.paciente_apellido,
                            dni: d.paciente_dni,
                          })
                        }
                      >
                        Abrir paciente
                      </Boton>
                    )}
                    <Boton onClick={() => atender(d.id)}>Marcar atendida</Boton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </TarjetaSeccion>

      {asignando && (
        <Modal
          abierto
          titulo={`Asignar cama a ${asignando.paciente_apellido}, ${asignando.paciente_nombre}`}
          onCerrar={() => setAsignando(null)}
        >
          <form onSubmit={confirmarCama} className="formulario">
            {camasDisponibles.length === 0 ? (
              <p className="aviso-error">
                No hay ninguna cama disponible en este momento. Liberá una cama desde
                Enfermería → Camas, o dá de alta camas nuevas.
              </p>
            ) : (
              <Campo label="Cama disponible">
                <select value={camaElegida} onChange={(e) => setCamaElegida(e.target.value)} required>
                  <option value="">Seleccionar…</option>
                  {camasDisponibles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo} — {String(c.sector).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            <div className="formulario__acciones">
              <Boton variante="secundario" type="button" onClick={() => setAsignando(null)}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={!camaElegida}>Asignar</Boton>
            </div>
          </form>
        </Modal>
      )}

      {atendidas.length > 0 && (
        <TarjetaSeccion titulo="Ya atendidas" subtitulo={`${atendidas.length} cerradas`}>
          <div className="lista-derivaciones lista-derivaciones--tenue">
            {atendidas.slice(0, 6).map((d) => (
              <article key={d.id} className="tarjeta-derivacion tarjeta-derivacion--atendida">
                <div className="tarjeta-derivacion__cabecera">
                  <div>
                    <p className="tarjeta-derivacion__paciente">
                      {d.paciente_apellido}, {d.paciente_nombre}
                    </p>
                    <p className="tarjeta-derivacion__meta">
                      desde {d.origen} · {cuandoFue(d.creado_en)}
                    </p>
                  </div>
                  <span className="estado-chip estado-chip--inactivo">Atendida</span>
                </div>
              </article>
            ))}
          </div>
        </TarjetaSeccion>
      )}
    </div>
  );
}

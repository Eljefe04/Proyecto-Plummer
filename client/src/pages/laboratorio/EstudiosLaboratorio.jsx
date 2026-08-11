import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Boton, TarjetaSeccion, EstadoVacio } from '../../components/ui';
import { useActualizacionTiempoReal, useDestelloActualizacion } from '../../hooks';

const ETAPAS = [
  { valor: 'pendiente', label: 'Pendiente', chip: 'pendiente' },
  { valor: 'muestra_tomada', label: 'Muestra tomada', chip: 'curso' },
  { valor: 'en_proceso', label: 'En proceso', chip: 'curso' },
  { valor: 'realizado', label: 'Realizado', chip: 'libre' },
];

function etapaDe(estado) {
  return ETAPAS.find((e) => e.valor === estado) || ETAPAS[0];
}

function cuandoFue(iso) {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-AR');
}

export default function EstudiosLaboratorio() {
  const [estudios, setEstudios] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [metricas, setMetricas] = useState({});
  const [cargando, setCargando] = useState(null); // estudio en el que se cargan resultados
  const [valores, setValores] = useState([]);
  const [observacion, setObservacion] = useState('');
  const [verResultado, setVerResultado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const { destellar, claseDe } = useDestelloActualizacion();

  const cargar = useCallback(async () => {
    try {
      const [e, m] = await Promise.all([
        api.get('/laboratorio'),
        api.get('/laboratorio/metricas').catch(() => ({})),
      ]);
      setEstudios(e);
      setMetricas(m);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
    api.get('/laboratorio/catalogo').then(setCatalogo).catch(() => {});
  }, [cargar]);

  useActualizacionTiempoReal('estudios_laboratorio', cargar);

  function abrirCarga(est) {
    setCargando(est);
    setObservacion(est.resultado || '');
    setError('');
    // Se arma la planilla a partir del catálogo: cada analito con su
    // unidad y su rango de referencia ya cargados.
    const filas = [];
    for (const nombre of est.estudios) {
      const def = catalogo.find((c) => c.nombre === nombre);
      if (def) {
        def.analitos.forEach((a) =>
          filas.push({ ...a, valor: '', grupo: nombre })
        );
      }
    }
    // Si el estudio no coincide con ninguno del catálogo (por ejemplo los
    // cargados antes con texto libre), se arranca con filas vacías EDITABLES
    // en vez de una fila muerta cuyo nombre no se podía escribir.
    if (filas.length === 0) {
      for (let i = 0; i < 3; i++) {
        filas.push({ analito: '', valor: '', unidad: '', min: null, max: null, grupo: 'Libre' });
      }
    }
    // Si ya tenía valores cargados, se respetan para poder corregir.
    if (est.valores && est.valores.length) {
      est.valores.forEach((v) => {
        const f = filas.find((x) => x.analito === v.analito);
        if (f) f.valor = v.valor;
      });
    }
    setValores(filas);
  }

  function cambiarCampo(i, campo, v) {
    setValores((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: v } : f)));
  }

  function agregarFila() {
    setValores((prev) => [...prev, { analito: '', valor: '', unidad: '', min: null, max: null, grupo: 'Libre' }]);
  }

  function quitarFila(i) {
    setValores((prev) => prev.filter((_, idx) => idx !== i));
  }

  function fueraDeRango(f) {
    const n = Number(f.valor);
    if (f.valor === '' || Number.isNaN(n)) return false;
    if (f.min !== null && f.min !== undefined && n < Number(f.min)) return true;
    if (f.max !== null && f.max !== undefined && n > Number(f.max)) return true;
    return false;
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');

    // Una fila solo cuenta si tiene NOMBRE y VALOR. Antes, si el analito
    // quedaba vacío, el servidor la descartaba sin decir nada y al médico
    // le llegaba un resultado sin valores.
    const cargables = valores.filter(
      (v) => String(v.analito).trim() !== '' && String(v.valor).trim() !== ''
    );

    if (cargables.length === 0 && !observacion.trim()) {
      setError('Cargá al menos un valor con su nombre, o escribí una observación.');
      return;
    }

    const sinNombre = valores.filter(
      (v) => String(v.valor).trim() !== '' && String(v.analito).trim() === ''
    );
    if (sinNombre.length > 0) {
      setError(`Hay ${sinNombre.length} valor(es) sin nombre de analito. Completalos o borrá esas filas.`);
      return;
    }

    try {
      await api.patch(`/laboratorio/${cargando.id}/resultado`, {
        resultado: observacion || null,
        valores: cargables,
      });
      destellar(cargando.id);
      setCargando(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cambiarEstado(id, estado) {
    setError('');
    try {
      await api.patch(`/laboratorio/${id}/estado`, { estado });
      destellar(id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const filtrados = estudios.filter((e) => {
    if (!busqueda.trim()) return true;
    const t = busqueda.toLowerCase();
    return (
      `${e.paciente_apellido} ${e.paciente_nombre}`.toLowerCase().includes(t) ||
      String(e.paciente_dni || '').includes(t) ||
      e.estudios.join(' ').toLowerCase().includes(t)
    );
  });

  const pendientes = filtrados.filter((e) => e.estado !== 'realizado');
  const listos = filtrados.filter((e) => e.estado === 'realizado');

  return (
    <div className="pila-secciones">
      {error && <div className="aviso-error">{error}</div>}

      <div className="metricas">
        {[
          { l: 'Pendientes', v: metricas.pendientes, c: 'pendiente' },
          { l: 'En curso', v: metricas.en_curso, c: 'curso' },
          { l: 'Urgentes', v: metricas.urgentes, c: 'urgente' },
          { l: 'Hechos hoy', v: metricas.hechos_hoy, c: 'libre' },
        ].map((m) => (
          <div key={m.l} className={`metrica metrica--${m.c} surgir`}>
            <p className="metrica__valor">{m.v ?? 0}</p>
            <p className="metrica__label">{m.l}</p>
          </div>
        ))}
      </div>

      <TarjetaSeccion
        titulo="Estudios solicitados"
        subtitulo="Los urgentes aparecen primero"
        acciones={
          <input
            className="buscador-simple"
            placeholder="Buscar paciente, DNI o estudio…"
            value={busqueda}
            onChange={(ev) => setBusqueda(ev.target.value)}
          />
        }
      >
        {pendientes.length === 0 ? (
          <EstadoVacio texto="No hay estudios pendientes." />
        ) : (
          <div className="lista-derivaciones">
            {pendientes.map((e) => {
              const et = etapaDe(e.estado);
              return (
                <article
                  key={e.id}
                  className={`tarjeta-derivacion surgir ${claseDe(e.id)} ${
                    e.prioridad === 'urgente' ? 'tarjeta-derivacion--urgente' : ''
                  }`}
                >
                  <div className="tarjeta-derivacion__cabecera">
                    <div>
                      <p className="tarjeta-derivacion__paciente">
                        {e.paciente_apellido}, {e.paciente_nombre}
                      </p>
                      <p className="tarjeta-derivacion__meta">
                        DNI {e.paciente_dni} · pedido por {e.solicitado_por} · {cuandoFue(e.creado_en)}
                      </p>
                    </div>
                    <span className={`estado-chip estado-chip--${e.prioridad === 'urgente' ? 'urgente' : et.chip}`}>
                      {e.prioridad === 'urgente' ? 'Urgente' : et.label}
                    </span>
                  </div>

                  <div className="receta-detalle">
                    <p className="receta-detalle__medicamento">{e.estudios.join(' · ')}</p>
                    {e.indicaciones && (
                      <p className="receta-detalle__indicaciones">{e.indicaciones}</p>
                    )}
                  </div>

                  <div className="tarjeta-derivacion__pie">
                    <div className="etapas">
                      {ETAPAS.slice(0, 3).map((s) => (
                        <button
                          key={s.valor}
                          className={`etapa ${e.estado === s.valor ? 'etapa--activa' : ''}`}
                          onClick={() => cambiarEstado(e.id, s.valor)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <Boton onClick={() => abrirCarga(e)}>Cargar resultados</Boton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </TarjetaSeccion>

      {listos.length > 0 && (
        <TarjetaSeccion titulo="Resultados cargados" subtitulo={`${listos.length} estudios completados`}>
          <div className="lista-derivaciones">
            {listos.slice(0, 12).map((e) => {
              const alterados = (e.valores || []).filter((v) => v.fuera_de_rango).length;
              return (
                <article key={e.id} className={`tarjeta-derivacion ${claseDe(e.id)}`}>
                  <div className="tarjeta-derivacion__cabecera">
                    <div>
                      <p className="tarjeta-derivacion__paciente">
                        {e.paciente_apellido}, {e.paciente_nombre}
                      </p>
                      <p className="tarjeta-derivacion__meta">
                        {e.estudios.join(' · ')} · {cuandoFue(e.completado_en)}
                      </p>
                    </div>
                    <span className={`estado-chip estado-chip--${alterados > 0 ? 'urgente' : 'libre'}`}>
                      {alterados > 0 ? `${alterados} fuera de rango` : 'Todo normal'}
                    </span>
                  </div>
                  <div className="tarjeta-derivacion__pie">
                    <span />
                    <div className="tarjeta-derivacion__botones">
                      <Boton variante="secundario" onClick={() => setVerResultado(e)}>Ver resultado</Boton>
                      <Boton variante="secundario" onClick={() => abrirCarga(e)}>Corregir</Boton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </TarjetaSeccion>
      )}

      {/* ---------- Carga de resultados ---------- */}
      {cargando && (
        <Modal
          abierto
          ancho={720}
          titulo={`Resultados — ${cargando.paciente_apellido}, ${cargando.paciente_nombre}`}
          onCerrar={() => setCargando(null)}
        >
          <form onSubmit={guardar} className="formulario">
            {error && <div className="aviso-error">{error}</div>}
            <p className="receta-detalle__pauta" style={{ marginBottom: 10 }}>
              {cargando.estudios.join(' · ')}
            </p>

            <table className="tabla tabla-responsive tabla-resultados">
              <thead>
                <tr><th>Analito</th><th>Valor</th><th>Unidad</th><th>Referencia</th><th /></tr>
              </thead>
              <tbody>
                {valores.map((f, i) => {
                  const delCatalogo = f.grupo !== 'Libre';
                  return (
                    <tr key={i} className={fueraDeRango(f) ? 'fila--alterada' : ''}>
                      <td data-label="Analito">
                        {delCatalogo ? (
                          <strong>{f.analito}</strong>
                        ) : (
                          <input
                            className="input-analito"
                            value={f.analito}
                            onChange={(ev) => cambiarCampo(i, 'analito', ev.target.value)}
                            placeholder="Nombre del analito"
                          />
                        )}
                      </td>
                      <td data-label="Valor">
                        <input
                          className={fueraDeRango(f) ? 'input-alterado' : ''}
                          value={f.valor}
                          onChange={(ev) => cambiarCampo(i, 'valor', ev.target.value)}
                          placeholder="—"
                        />
                      </td>
                      <td data-label="Unidad">
                        {delCatalogo ? f.unidad : (
                          <input
                            className="input-unidad"
                            value={f.unidad || ''}
                            onChange={(ev) => cambiarCampo(i, 'unidad', ev.target.value)}
                            placeholder="mg/dL"
                          />
                        )}
                      </td>
                      <td data-label="Referencia">
                        {f.min !== null && f.min !== undefined && f.max !== null && f.max !== undefined
                          ? `${f.min} – ${f.max}`
                          : '—'}
                      </td>
                      <td data-label="">
                        {!delCatalogo && (
                          <button type="button" className="quitar-fila" onClick={() => quitarFila(i)}>
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <button type="button" className="agregar-fila" onClick={agregarFila}>
              + Agregar otro valor
            </button>

            <label className="campo">
              <span className="campo__label">Observaciones del laboratorio</span>
              <textarea
                rows={3}
                value={observacion}
                onChange={(ev) => setObservacion(ev.target.value)}
                placeholder="Comentarios, aclaraciones sobre la muestra, etc."
              />
            </label>

            <div className="formulario__acciones">
              <Boton variante="secundario" type="button" onClick={() => setCargando(null)}>Cancelar</Boton>
              <Boton type="submit">Guardar y avisar al médico</Boton>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------- Ver resultado ---------- */}
      {verResultado && (
        <Modal
          abierto
          ancho={680}
          titulo={`${verResultado.paciente_apellido}, ${verResultado.paciente_nombre}`}
          onCerrar={() => setVerResultado(null)}
        >
          <TablaResultados estudio={verResultado} />
        </Modal>
      )}
    </div>
  );
}

/** Tabla de resultados con los valores fuera de rango marcados. */
export function TablaResultados({ estudio }) {
  const valores = estudio.valores || [];
  return (
    <div>
      <p className="receta-detalle__pauta" style={{ marginBottom: 10 }}>
        {estudio.estudios ? estudio.estudios.join(' · ') : ''}
      </p>
      {valores.length === 0 ? (
        <p className="ayuda-campo">Sin valores cargados.</p>
      ) : (
        <table className="tabla tabla-responsive tabla-resultados">
          <thead>
            <tr><th>Analito</th><th>Valor</th><th>Unidad</th><th>Referencia</th></tr>
          </thead>
          <tbody>
            {valores.map((v) => (
              <tr key={v.id} className={v.fuera_de_rango ? 'fila--alterada' : ''}>
                <td data-label="Analito">{v.analito}</td>
                <td data-label="Valor">
                  <strong>{v.valor}</strong>
                  {v.fuera_de_rango && (
                    <span className="flecha-rango">{v.direccion === 'alto' ? '▲' : '▼'}</span>
                  )}
                </td>
                <td data-label="Unidad">{v.unidad || '—'}</td>
                <td data-label="Referencia">
                  {v.ref_min !== null && v.ref_max !== null ? `${v.ref_min} – ${v.ref_max}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {estudio.resultado && (
        <div className="receta-detalle" style={{ marginTop: 12 }}>
          <p className="receta-detalle__indicaciones">{estudio.resultado}</p>
        </div>
      )}
    </div>
  );
}

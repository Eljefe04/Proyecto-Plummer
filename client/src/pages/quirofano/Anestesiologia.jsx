import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';
import { useActualizacionTiempoReal, useDestelloActualizacion } from '../../hooks';

const TIPOS_ANESTESIA = ['General', 'Raquídea', 'Peridural', 'Local', 'Sedación'];

function cuandoFue(iso) {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-AR');
}

export default function Anestesiologia() {
  const [fichas, setFichas] = useState([]);
  const [cirugias, setCirugias] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [medicos, setMedicos] = useState([]);

  const [creando, setCreando] = useState(null);   // cirugía sin ficha
  const [drogasDe, setDrogasDe] = useState(null);
  const [recupDe, setRecupDe] = useState(null);
  const [verFicha, setVerFicha] = useState(null);

  const [form, setForm] = useState({});
  const [lineas, setLineas] = useState([]);
  const [recup, setRecup] = useState({});
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const { destellar, claseDe } = useDestelloActualizacion();

  const cargar = useCallback(async () => {
    try {
      const [f, c, m, md] = await Promise.all([
        api.get('/quirofano/fichas-anestesicas'),
        api.get('/quirofano/cirugias'),
        api.get('/farmacia/medicamentos').catch(() => []),
        api.get('/medicos').catch(() => []),
      ]);
      setFichas(f);
      setCirugias(c);
      setMedicamentos(m);
      setMedicos(md);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal(['cirugias', 'fichas_anestesicas', 'medicamentos'], cargar);

  const anestesiologos = medicos.filter((m) => m.especialidad === 'anestesiologia');

  // ------------------------------------------------------------
  // Las dos bandejas salen de datos que ya existen, sin tablas nuevas:
  //  - Anestesia pendiente = cirugía programada sin ficha asociada.
  //  - Reanimación pendiente = ficha cuya cirugía terminó y todavía no
  //    tiene cargado el estado de recuperación.
  // ------------------------------------------------------------
  const conFicha = new Set(fichas.map((f) => f.cirugia_id));
  const pendientes = cirugias.filter(
    (c) => ['solicitada', 'programada', 'en_curso'].includes(c.estado) && !conFicha.has(c.id)
  );
  const enRecuperacion = fichas.filter((f) => !f.recuperacion_estado_alta);
  const cerradas = fichas.filter((f) => f.recuperacion_estado_alta);

  function abrirCrear(c) {
    setCreando(c);
    setError('');
    setForm({
      cirugia_id: c.id,
      paciente_id: c.paciente_id,
      anestesiologo_id: c.anestesiologo_id || (anestesiologos[0] ? anestesiologos[0].id : ''),
      tipo_anestesia: 'General',
      clasificacion_asa: 'ASA II',
      evaluacion_preanestesica: '',
    });
  }

  async function crearFicha(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/quirofano/fichas-anestesicas', form);
      setCreando(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  function abrirDrogas(f) {
    setDrogasDe(f);
    setError('');
    setLineas([{ medicamento_id: '', cantidad: 1, detalle: '' }]);
  }

  async function guardarDrogas(e) {
    e.preventDefault();
    setError('');
    const validas = lineas.filter((l) => l.medicamento_id && Number(l.cantidad) > 0);
    if (validas.length === 0) {
      setError('Cargá al menos una droga o fluido con su cantidad.');
      return;
    }
    try {
      const r = await api.patch(`/quirofano/fichas-anestesicas/${drogasDe.id}/drogas`, {
        drogas: validas,
      });
      destellar(drogasDe.id);
      setExito(r.stock_descontado
        ? 'Drogas registradas y stock descontado de Farmacia.'
        : 'Drogas registradas.');
      setDrogasDe(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  function abrirRecuperacion(f) {
    setRecupDe(f);
    setError('');
    setRecup({
      recuperacion_signos_vitales: '',
      recuperacion_tiempo: '',
      recuperacion_estado_alta: 'estable',
      recuperacion_observaciones: '',
    });
  }

  async function guardarRecuperacion(e) {
    e.preventDefault();
    setError('');
    try {
      await api.patch(`/quirofano/fichas-anestesicas/${recupDe.id}/recuperacion`, recup);
      destellar(recupDe.id);
      setExito('Recuperación registrada. La ficha queda cerrada.');
      setRecupDe(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="pila-secciones">
      {error && !creando && !drogasDe && !recupDe && <div className="aviso-error">{error}</div>}
      {exito && <div className="aviso-exito">{exito}</div>}

      <div className="metricas">
        {[
          { l: 'Anestesias pendientes', v: pendientes.length, c: 'pendiente' },
          { l: 'En recuperación', v: enRecuperacion.length, c: 'curso' },
          { l: 'Fichas cerradas', v: cerradas.length, c: 'libre' },
          { l: 'Anestesiólogos', v: anestesiologos.length, c: 'inactivo' },
        ].map((m) => (
          <div key={m.l} className={`metrica metrica--${m.c} surgir`}>
            <p className="metrica__valor">{m.v}</p>
            <p className="metrica__label">{m.l}</p>
          </div>
        ))}
      </div>

      <TarjetaSeccion
        titulo="Anestesias pendientes"
        subtitulo="Cirugías programadas que todavía no tienen ficha anestésica"
        acciones={pendientes.length > 0 && (
          <span className="estado-chip estado-chip--pendiente">{pendientes.length} sin ficha</span>
        )}
      >
        {pendientes.length === 0 ? (
          <EstadoVacio texto="No hay anestesias pendientes." />
        ) : (
          <div className="lista-derivaciones">
            {pendientes.map((c) => (
              <article
                key={c.id}
                className={`tarjeta-derivacion surgir ${c.caracter === 'urgente' ? 'tarjeta-derivacion--urgente' : ''}`}
              >
                <div className="tarjeta-derivacion__cabecera">
                  <div>
                    <p className="tarjeta-derivacion__paciente">
                      {c.paciente_apellido}, {c.paciente_nombre}
                    </p>
                    <p className="tarjeta-derivacion__meta">
                      {c.tipo_cirugia}
                      {c.fecha_programada ? ` · ${c.fecha_programada} ${c.hora_inicio || ''}` : ''}
                      {c.quirofano ? ` · ${c.quirofano}` : ''}
                    </p>
                  </div>
                  <span className={`estado-chip estado-chip--${c.caracter === 'urgente' ? 'urgente' : 'pendiente'}`}>
                    {c.caracter === 'urgente' ? 'URGENTE' : c.estado}
                  </span>
                </div>
                <div className="tarjeta-derivacion__pie">
                  <span />
                  <Boton onClick={() => abrirCrear(c)}>Crear ficha anestésica</Boton>
                </div>
              </article>
            ))}
          </div>
        )}
      </TarjetaSeccion>

      <TarjetaSeccion
        titulo="En recuperación"
        subtitulo="Fichas abiertas: falta registrar drogas o el estado al alta"
      >
        {enRecuperacion.length === 0 ? (
          <EstadoVacio texto="No hay pacientes en recuperación." />
        ) : (
          <div className="lista-derivaciones">
            {enRecuperacion.map((f) => (
              <article key={f.id} className={`tarjeta-derivacion surgir ${claseDe(f.id)}`}>
                <div className="tarjeta-derivacion__cabecera">
                  <div>
                    <p className="tarjeta-derivacion__paciente">
                      {f.paciente_apellido}, {f.paciente_nombre}
                    </p>
                    <p className="tarjeta-derivacion__meta">
                      {f.tipo_cirugia || 'Cirugía'} · {cuandoFue(f.creado_en)}
                      {f.anestesiologo_apellido ? ` · Dr. ${f.anestesiologo_apellido}` : ''}
                    </p>
                  </div>
                  <span className="estado-chip estado-chip--curso">
                    {f.tipo_anestesia}{f.clasificacion_asa ? ` · ${f.clasificacion_asa}` : ''}
                  </span>
                </div>

                {f.evaluacion_preanestesica && (
                  <div className="receta-detalle">
                    <p className="receta-detalle__indicaciones">{f.evaluacion_preanestesica}</p>
                  </div>
                )}

                <div className="tarjeta-derivacion__pie">
                  {f.drogas_fluidos
                    ? <span className="estado-chip estado-chip--libre">Drogas registradas</span>
                    : <span className="estado-chip estado-chip--pendiente">Sin drogas cargadas</span>}
                  <div className="tarjeta-derivacion__botones">
                    <Boton variante="secundario" onClick={() => abrirDrogas(f)}>Drogas y fluidos</Boton>
                    <Boton onClick={() => abrirRecuperacion(f)}>Cerrar recuperación</Boton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </TarjetaSeccion>

      {cerradas.length > 0 && (
        <TarjetaSeccion titulo="Fichas cerradas" subtitulo={`${cerradas.length} anestesias completadas`}>
          <div className="lista-derivaciones lista-derivaciones--tenue">
            {cerradas.slice(0, 10).map((f) => (
              <article key={f.id} className="tarjeta-derivacion">
                <div className="tarjeta-derivacion__cabecera">
                  <div>
                    <p className="tarjeta-derivacion__paciente">
                      {f.paciente_apellido}, {f.paciente_nombre}
                    </p>
                    <p className="tarjeta-derivacion__meta">
                      {f.tipo_anestesia} · alta {f.recuperacion_estado_alta}
                      {f.recuperacion_tiempo ? ` · ${f.recuperacion_tiempo}` : ''}
                    </p>
                  </div>
                  <span className="estado-chip estado-chip--inactivo">Cerrada</span>
                </div>
                <div className="tarjeta-derivacion__pie">
                  <span />
                  <Boton variante="secundario" onClick={() => setVerFicha(f)}>Ver ficha</Boton>
                </div>
              </article>
            ))}
          </div>
        </TarjetaSeccion>
      )}

      {/* ---------- Crear ficha ---------- */}
      {creando && (
        <Modal abierto ancho={600} titulo="Nueva ficha anestésica" onCerrar={() => setCreando(null)}>
          <form onSubmit={crearFicha} className="formulario">
            {error && <div className="aviso-error">{error}</div>}
            <div className="receta-fijada">
              <p className="receta-fijada__label">Paciente y cirugía</p>
              <p className="receta-fijada__valor">
                {creando.paciente_apellido}, {creando.paciente_nombre}
              </p>
              <p className="receta-fijada__meta">{creando.tipo_cirugia}</p>
            </div>

            <div className="grilla-campos">
              <Campo label="Anestesiólogo">
                <select
                  value={form.anestesiologo_id}
                  onChange={(e) => setForm({ ...form, anestesiologo_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {anestesiologos.map((m) => (
                    <option key={m.id} value={m.id}>{m.apellido}, {m.nombre}</option>
                  ))}
                </select>
              </Campo>

              <Campo label="Tipo de anestesia">
                <select
                  value={form.tipo_anestesia}
                  onChange={(e) => setForm({ ...form, tipo_anestesia: e.target.value })}
                >
                  {TIPOS_ANESTESIA.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Campo>

              <Campo label="Riesgo ASA">
                <select
                  value={form.clasificacion_asa}
                  onChange={(e) => setForm({ ...form, clasificacion_asa: e.target.value })}
                >
                  {['ASA I', 'ASA II', 'ASA III', 'ASA IV', 'ASA V'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Campo>
            </div>

            <Campo label="Valoración prequirúrgica">
              <textarea
                rows={4}
                value={form.evaluacion_preanestesica}
                onChange={(e) => setForm({ ...form, evaluacion_preanestesica: e.target.value })}
                placeholder={'Antecedentes relevantes:\nVía aérea:\nAyuno:\nPlan anestésico:'}
              />
            </Campo>

            <div className="formulario__acciones">
              <Boton variante="secundario" type="button" onClick={() => setCreando(null)}>Cancelar</Boton>
              <Boton type="submit">Crear ficha</Boton>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------- Drogas y fluidos ---------- */}
      {drogasDe && (
        <Modal abierto ancho={640} titulo="Drogas y fluidos utilizados" onCerrar={() => setDrogasDe(null)}>
          <form onSubmit={guardarDrogas} className="formulario">
            {error && <div className="aviso-error">{error}</div>}
            <p className="ayuda-campo" style={{ marginBottom: 10 }}>
              Lo que cargues acá se descuenta automáticamente del stock de Farmacia.
            </p>

            <table className="tabla tabla-responsive">
              <thead>
                <tr><th>Droga o fluido</th><th>Cantidad</th><th>Detalle</th><th /></tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td data-label="Droga">
                      <select
                        value={l.medicamento_id}
                        onChange={(e) => setLineas(lineas.map((x, j) =>
                          j === i ? { ...x, medicamento_id: e.target.value } : x))}
                      >
                        <option value="">Seleccionar…</option>
                        {medicamentos.map((m) => (
                          <option key={m.id} value={m.id} disabled={m.stock <= 0}>
                            {m.nombre} — stock {m.stock}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td data-label="Cantidad">
                      <input
                        type="number" min="1" value={l.cantidad}
                        onChange={(e) => setLineas(lineas.map((x, j) =>
                          j === i ? { ...x, cantidad: e.target.value } : x))}
                      />
                    </td>
                    <td data-label="Detalle">
                      <input
                        value={l.detalle}
                        placeholder="dosis, vía…"
                        onChange={(e) => setLineas(lineas.map((x, j) =>
                          j === i ? { ...x, detalle: e.target.value } : x))}
                      />
                    </td>
                    <td>
                      {lineas.length > 1 && (
                        <button type="button" className="quitar-fila"
                          onClick={() => setLineas(lineas.filter((_, j) => j !== i))}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button type="button" className="agregar-fila"
              onClick={() => setLineas([...lineas, { medicamento_id: '', cantidad: 1, detalle: '' }])}>
              + Agregar otra droga
            </button>

            <div className="formulario__acciones">
              <Boton variante="secundario" type="button" onClick={() => setDrogasDe(null)}>Cancelar</Boton>
              <Boton type="submit">Registrar y descontar stock</Boton>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------- Recuperación ---------- */}
      {recupDe && (
        <Modal abierto ancho={600} titulo="Recuperación postanestésica" onCerrar={() => setRecupDe(null)}>
          <form onSubmit={guardarRecuperacion} className="formulario">
            {error && <div className="aviso-error">{error}</div>}
            <Campo label="Signos vitales en recuperación">
              <input
                value={recup.recuperacion_signos_vitales}
                placeholder="TA 120/80 · FC 78 · SatO2 98%"
                onChange={(e) => setRecup({ ...recup, recuperacion_signos_vitales: e.target.value })}
                required
              />
            </Campo>

            <div className="grilla-campos">
              <Campo label="Tiempo en recuperación">
                <input
                  value={recup.recuperacion_tiempo}
                  placeholder="45 min"
                  onChange={(e) => setRecup({ ...recup, recuperacion_tiempo: e.target.value })}
                />
              </Campo>

              <Campo label="Estado al alta">
                <select
                  value={recup.recuperacion_estado_alta}
                  onChange={(e) => setRecup({ ...recup, recuperacion_estado_alta: e.target.value })}
                >
                  <option value="estable">Estable</option>
                  <option value="con_observacion">Con observación</option>
                  <option value="derivado_uti">Derivado a UTI</option>
                </select>
              </Campo>
            </div>

            <Campo label="Observaciones">
              <textarea
                rows={3}
                value={recup.recuperacion_observaciones}
                onChange={(e) => setRecup({ ...recup, recuperacion_observaciones: e.target.value })}
              />
            </Campo>

            <div className="formulario__acciones">
              <Boton variante="secundario" type="button" onClick={() => setRecupDe(null)}>Cancelar</Boton>
              <Boton type="submit">Cerrar ficha</Boton>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------- Ver ficha ---------- */}
      {verFicha && (
        <Modal
          abierto ancho={620}
          titulo={`${verFicha.paciente_apellido}, ${verFicha.paciente_nombre}`}
          onCerrar={() => setVerFicha(null)}
        >
          <div className="receta-fijada">
            <p className="receta-fijada__label">Anestesia</p>
            <p className="receta-fijada__valor">
              {verFicha.tipo_anestesia}{verFicha.clasificacion_asa ? ` · ${verFicha.clasificacion_asa}` : ''}
            </p>
          </div>
          {verFicha.evaluacion_preanestesica && (
            <pre className="informe-texto">{verFicha.evaluacion_preanestesica}</pre>
          )}
          {verFicha.drogas_fluidos && (
            <>
              <p className="receta-fijada__label" style={{ marginTop: 12 }}>Drogas y fluidos</p>
              <pre className="informe-texto">{verFicha.drogas_fluidos}</pre>
            </>
          )}
          <p className="receta-fijada__label" style={{ marginTop: 12 }}>Recuperación</p>
          <pre className="informe-texto">
            {[verFicha.recuperacion_signos_vitales,
              verFicha.recuperacion_tiempo && `Tiempo: ${verFicha.recuperacion_tiempo}`,
              verFicha.recuperacion_estado_alta && `Estado al alta: ${verFicha.recuperacion_estado_alta}`,
              verFicha.recuperacion_observaciones].filter(Boolean).join('\n')}
          </pre>
        </Modal>
      )}
    </div>
  );
}

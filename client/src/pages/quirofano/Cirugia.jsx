import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';
import { useActualizacionTiempoReal, useDestelloActualizacion } from '../../hooks';

const QUIROFANOS = ['Quirófano A', 'Quirófano B'];
const COMPLEJIDADES = [
  { valor: 'baja', label: 'Baja — alta en 1 día' },
  { valor: 'media', label: 'Media — alta en 3 días' },
  { valor: 'alta', label: 'Alta — alta en 7 días' },
];

// Checklist de seguridad quirúrgica de la OMS (pausa quirúrgica).
// No es un invento del proyecto: es un estándar internacional.
const CHECKLIST_OMS = [
  { clave: 'identidad', label: 'Se confirmó identidad del paciente' },
  { clave: 'sitio', label: 'Se confirmó el sitio quirúrgico' },
  { clave: 'consentimiento', label: 'Consentimiento informado firmado' },
  { clave: 'alergias', label: 'Se revisaron alergias conocidas' },
  { clave: 'via_aerea', label: 'Vía aérea evaluada' },
  { clave: 'antibiotico', label: 'Profilaxis antibiótica administrada' },
  { clave: 'instrumental', label: 'Recuento de gasas e instrumental' },
  { clave: 'equipo', label: 'El equipo se presentó por nombre y función' },
];

function cuandoFue(iso) {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-AR');
}

export default function Cirugia() {
  const [cirugias, setCirugias] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [programando, setProgramando] = useState(null);
  const [finalizando, setFinalizando] = useState(null);
  const [checklistDe, setChecklistDe] = useState(null);
  const [verParte, setVerParte] = useState(null);
  const [creando, setCreando] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [nueva, setNueva] = useState({ paciente_id: '', tipo_cirugia: '', caracter: 'programada' });
  const [form, setForm] = useState({});
  const [parte, setParte] = useState('');
  const [marcas, setMarcas] = useState({});
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const { destellar, claseDe } = useDestelloActualizacion();

  const cargar = useCallback(async () => {
    try {
      const [c, m, p] = await Promise.all([
        api.get('/quirofano/cirugias'),
        api.get('/medicos'),
        api.get('/pacientes').catch(() => []),
      ]);
      setCirugias(c);
      setMedicos(m);
      setPacientes(Array.isArray(p) ? p : (p.pacientes || []));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal('cirugias', cargar);

  const cirujanos = medicos.filter((m) => m.especialidad === 'cirugia');
  const anestesiologos = medicos.filter((m) => m.especialidad === 'anestesiologia');

  function abrirProgramar(c) {
    setProgramando(c);
    setError('');
    setForm({
      cirujano_id: c.cirujano_id || '',
      anestesiologo_id: c.anestesiologo_id || '',
      quirofano: c.quirofano || QUIROFANOS[0],
      fecha_programada: c.fecha_programada || new Date().toISOString().slice(0, 10),
      hora_inicio: c.hora_inicio || '',
      duracion_estimada: c.duracion_estimada || '',
      complejidad: c.complejidad || 'media',
      tipo_intervencion: c.tipo_intervencion || 'internacion',
      notas_prequirurgicas: c.notas_prequirurgicas || '',
    });
  }

  async function guardarProgramacion(e) {
    e.preventDefault();
    setError('');
    try {
      await api.patch(`/quirofano/cirugias/${programando.id}/programar`, form);
      destellar(programando.id);
      setProgramando(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  // Quirófano también puede dar de alta una cirugía por su cuenta, sin
  // esperar la solicitud de un médico (por ejemplo, una urgencia que
  // entra directo o una intervención acordada por teléfono).
  async function crearCirugia(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/quirofano/cirugias', { ...nueva, estado: 'solicitada' });
      setCreando(false);
      setNueva({ paciente_id: '', tipo_cirugia: '', caracter: 'programada' });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cambiarEstado(id, estado) {
    setError('');
    try {
      await api.patch(`/quirofano/cirugias/${id}/estado`, { estado });
      destellar(id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function finalizar(e) {
    e.preventDefault();
    setError('');
    try {
      const r = await api.patch(`/quirofano/cirugias/${finalizando.id}/estado`, {
        estado: 'finalizada',
        parte_quirurgico: parte,
      });
      destellar(finalizando.id);
      setExito(
        r.cama_asignada
          ? `Cirugía finalizada. Cama ${r.cama_asignada} asignada, alta sugerida en ${r.dias_estimados} días.`
          : r.advertencia || 'Cirugía finalizada.'
      );
      setFinalizando(null);
      setParte('');
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  function abrirChecklist(c) {
    setChecklistDe(c);
    setError('');
    let previo = {};
    try { previo = c.checklist_oms ? JSON.parse(c.checklist_oms) : {}; } catch { previo = {}; }
    setMarcas(previo);
  }

  async function guardarChecklist() {
    setError('');
    try {
      await api.patch(`/quirofano/cirugias/${checklistDe.id}/checklist`, { checklist: marcas });
      destellar(checklistDe.id);
      setChecklistDe(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const solicitadas = cirugias.filter((c) => c.estado === 'solicitada');
  const programadas = cirugias.filter((c) => ['programada', 'en_curso'].includes(c.estado));
  const hechas = cirugias.filter((c) => c.estado === 'finalizada');

  function tarjeta(c, acciones) {
    let hechos = 0;
    try {
      const m = c.checklist_oms ? JSON.parse(c.checklist_oms) : {};
      hechos = Object.values(m).filter(Boolean).length;
    } catch { hechos = 0; }

    return (
      <article
        key={c.id}
        className={`tarjeta-derivacion surgir ${claseDe(c.id)} ${
          c.caracter === 'urgente' && c.estado !== 'finalizada' ? 'tarjeta-derivacion--urgente' : ''
        }`}
      >
        <div className="tarjeta-derivacion__cabecera">
          <div>
            <p className="tarjeta-derivacion__paciente">
              {c.paciente_apellido}, {c.paciente_nombre}
            </p>
            <p className="tarjeta-derivacion__meta">
              {c.solicitante_apellido ? `Pedida por Dr. ${c.solicitante_apellido} · ` : ''}
              {cuandoFue(c.creado_en)}
              {c.cama_codigo ? ` · Cama ${c.cama_codigo}` : ''}
            </p>
          </div>
          <span className={`estado-chip estado-chip--${
            c.estado === 'finalizada' ? 'libre'
            : c.estado === 'en_curso' ? 'curso'
            : c.caracter === 'urgente' ? 'urgente' : 'pendiente'
          }`}>
            {c.caracter === 'urgente' && c.estado !== 'finalizada' ? 'URGENTE' : c.estado}
          </span>
        </div>

        <div className="receta-detalle">
          <p className="receta-detalle__medicamento">{c.tipo_cirugia}</p>
          <p className="receta-detalle__pauta">
            {[
              c.quirofano,
              c.fecha_programada && `${c.fecha_programada} ${c.hora_inicio || ''}`.trim(),
              c.cirujano_apellido && `Cir. ${c.cirujano_apellido}`,
              c.anestesiologo_apellido && `Anest. ${c.anestesiologo_apellido}`,
              c.complejidad && `complejidad ${c.complejidad}`,
            ].filter(Boolean).join(' · ') || 'Sin programar'}
          </p>
          {c.notas_prequirurgicas && (
            <p className="receta-detalle__indicaciones">{c.notas_prequirurgicas}</p>
          )}
        </div>

        <div className="tarjeta-derivacion__pie">
          {hechos > 0 ? (
            <span className={`estado-chip estado-chip--${hechos === CHECKLIST_OMS.length ? 'libre' : 'pendiente'}`}>
              Checklist {hechos}/{CHECKLIST_OMS.length}
            </span>
          ) : <span />}
          <div className="tarjeta-derivacion__botones">{acciones}</div>
        </div>
      </article>
    );
  }

  return (
    <div className="pila-secciones">
      {error && <div className="aviso-error">{error}</div>}
      {exito && <div className="aviso-exito">{exito}</div>}

      <TarjetaSeccion
        titulo="Solicitudes recibidas"
        subtitulo="Cirugías pedidas por los médicos, todavía sin programar"
        acciones={
          <div className="tarjeta-derivacion__botones">
            {solicitadas.length > 0 && (
              <span className="estado-chip estado-chip--pendiente">{solicitadas.length} sin programar</span>
            )}
            <Boton onClick={() => { setCreando(true); setError(''); }}>+ Nueva cirugía</Boton>
          </div>
        }
      >
        {solicitadas.length === 0 ? (
          <EstadoVacio texto="No hay solicitudes pendientes." />
        ) : (
          <div className="lista-derivaciones">
            {solicitadas.map((c) => tarjeta(c, (
              <Boton onClick={() => abrirProgramar(c)}>Programar</Boton>
            )))}
          </div>
        )}
      </TarjetaSeccion>

      <TarjetaSeccion titulo="Programadas y en curso" subtitulo="Agenda del quirófano">
        {programadas.length === 0 ? (
          <EstadoVacio texto="No hay cirugías programadas." />
        ) : (
          <div className="lista-derivaciones">
            {programadas.map((c) => tarjeta(c, (
              <>
                <Boton variante="secundario" onClick={() => abrirChecklist(c)}>Checklist</Boton>
                <Boton variante="secundario" onClick={() => abrirProgramar(c)}>Editar</Boton>
                {c.estado === 'programada' && (
                  <Boton variante="secundario" onClick={() => cambiarEstado(c.id, 'en_curso')}>
                    Iniciar
                  </Boton>
                )}
                <Boton onClick={() => { setFinalizando(c); setParte(''); setError(''); }}>
                  Finalizar
                </Boton>
              </>
            )))}
          </div>
        )}
      </TarjetaSeccion>

      {hechas.length > 0 && (
        <TarjetaSeccion titulo="Realizadas" subtitulo={`${hechas.length} cirugías finalizadas`}>
          <div className="lista-derivaciones">
            {hechas.slice(0, 10).map((c) => tarjeta(c, (
              <Boton variante="secundario" onClick={() => setVerParte(c)}>Ver parte quirúrgico</Boton>
            )))}
          </div>
        </TarjetaSeccion>
      )}

      {creando && (
        <Modal abierto ancho={560} titulo="Nueva cirugía" onCerrar={() => setCreando(false)}>
          <form onSubmit={crearCirugia} className="formulario">
            {error && <div className="aviso-error">{error}</div>}
            <Campo label="Paciente">
              <select
                value={nueva.paciente_id}
                onChange={(e) => setNueva({ ...nueva, paciente_id: e.target.value })}
                required
              >
                <option value="">Seleccionar…</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.apellido}, {p.nombre} — DNI {p.dni}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Intervención">
              <input
                value={nueva.tipo_cirugia}
                placeholder="Ej: Colecistectomía"
                onChange={(e) => setNueva({ ...nueva, tipo_cirugia: e.target.value })}
                required
              />
            </Campo>

            <Campo label="Carácter">
              <select
                value={nueva.caracter}
                onChange={(e) => setNueva({ ...nueva, caracter: e.target.value })}
              >
                <option value="programada">Programada</option>
                <option value="urgente">Urgente</option>
              </select>
            </Campo>

            <div className="formulario__acciones">
              <Boton variante="secundario" type="button" onClick={() => setCreando(false)}>Cancelar</Boton>
              <Boton type="submit">Crear solicitud</Boton>
            </div>
          </form>
        </Modal>
      )}

      {programando && (
        <Modal
          abierto
          ancho={640}
          titulo={`Programar — ${programando.paciente_apellido}, ${programando.paciente_nombre}`}
          onCerrar={() => setProgramando(null)}
        >
          <form onSubmit={guardarProgramacion} className="formulario">
            {error && <div className="aviso-error">{error}</div>}
            <div className="receta-fijada">
              <p className="receta-fijada__label">Intervención</p>
              <p className="receta-fijada__valor">{programando.tipo_cirugia}</p>
            </div>

            <div className="grilla-campos">
              <Campo label="Cirujano">
                <select
                  value={form.cirujano_id}
                  onChange={(e) => setForm({ ...form, cirujano_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar…</option>
                  {cirujanos.map((m) => (
                    <option key={m.id} value={m.id}>{m.apellido}, {m.nombre} ({m.matricula})</option>
                  ))}
                </select>
              </Campo>

              <Campo label="Anestesiólogo">
                <select
                  value={form.anestesiologo_id}
                  onChange={(e) => setForm({ ...form, anestesiologo_id: e.target.value })}
                >
                  <option value="">Seleccionar…</option>
                  {anestesiologos.map((m) => (
                    <option key={m.id} value={m.id}>{m.apellido}, {m.nombre} ({m.matricula})</option>
                  ))}
                </select>
              </Campo>

              <Campo label="Quirófano">
                <select
                  value={form.quirofano}
                  onChange={(e) => setForm({ ...form, quirofano: e.target.value })}
                >
                  {QUIROFANOS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </Campo>

              <Campo label="Fecha">
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={form.fecha_programada}
                  onChange={(e) => setForm({ ...form, fecha_programada: e.target.value })}
                  required
                />
              </Campo>

              <Campo label="Hora de inicio">
                <input
                  type="time"
                  value={form.hora_inicio}
                  onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                  required
                />
              </Campo>

              <Campo label="Duración estimada">
                <input
                  value={form.duracion_estimada}
                  placeholder="90 min"
                  onChange={(e) => setForm({ ...form, duracion_estimada: e.target.value })}
                />
              </Campo>

              <Campo label="Complejidad">
                <select
                  value={form.complejidad}
                  onChange={(e) => setForm({ ...form, complejidad: e.target.value })}
                >
                  {COMPLEJIDADES.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
                </select>
              </Campo>

              <Campo label="Tipo de intervención">
                <select
                  value={form.tipo_intervencion}
                  onChange={(e) => setForm({ ...form, tipo_intervencion: e.target.value })}
                >
                  <option value="internacion">Con internación</option>
                  <option value="ambulatoria">Ambulatoria</option>
                </select>
              </Campo>
            </div>

            <Campo label="Notas prequirúrgicas">
              <textarea
                rows={3}
                value={form.notas_prequirurgicas}
                onChange={(e) => setForm({ ...form, notas_prequirurgicas: e.target.value })}
              />
            </Campo>

            <div className="formulario__acciones">
              <Boton variante="secundario" type="button" onClick={() => setProgramando(null)}>Cancelar</Boton>
              <Boton type="submit">Guardar programación</Boton>
            </div>
          </form>
        </Modal>
      )}

      {checklistDe && (
        <Modal
          abierto
          ancho={560}
          titulo="Checklist de seguridad quirúrgica (OMS)"
          onCerrar={() => setChecklistDe(null)}
        >
          <p className="ayuda-campo" style={{ marginBottom: 12 }}>
            Pausa quirúrgica antes de comenzar. Estándar de la Organización Mundial de la Salud.
          </p>
          <div className="checklist">
            {CHECKLIST_OMS.map((i) => (
              <label key={i.clave} className="checklist__item">
                <input
                  type="checkbox"
                  checked={!!marcas[i.clave]}
                  onChange={(e) => setMarcas({ ...marcas, [i.clave]: e.target.checked })}
                />
                <span>{i.label}</span>
              </label>
            ))}
          </div>
          <div className="formulario__acciones">
            <Boton variante="secundario" onClick={() => setChecklistDe(null)}>Cancelar</Boton>
            <Boton onClick={guardarChecklist}>Guardar checklist</Boton>
          </div>
        </Modal>
      )}

      {finalizando && (
        <Modal
          abierto
          ancho={640}
          titulo={`Finalizar — ${finalizando.paciente_apellido}, ${finalizando.paciente_nombre}`}
          onCerrar={() => setFinalizando(null)}
        >
          <form onSubmit={finalizar} className="formulario">
            {error && <div className="aviso-error">{error}</div>}
            <p className="ayuda-campo" style={{ marginBottom: 10 }}>
              Al finalizar, si la intervención es con internación se le asigna cama al paciente
              y se lo deriva a Internación con la fecha de alta sugerida según la complejidad.
            </p>
            <Campo label="Parte quirúrgico">
              <textarea
                rows={9}
                value={parte}
                onChange={(e) => setParte(e.target.value)}
                placeholder={'Procedimiento realizado:\nHallazgos:\nComplicaciones:\nMaterial enviado a anatomía patológica:'}
                required
              />
            </Campo>
            <div className="formulario__acciones">
              <Boton variante="secundario" type="button" onClick={() => setFinalizando(null)}>Cancelar</Boton>
              <Boton type="submit">Finalizar cirugía</Boton>
            </div>
          </form>
        </Modal>
      )}

      {verParte && (
        <Modal
          abierto
          ancho={640}
          titulo={`${verParte.paciente_apellido}, ${verParte.paciente_nombre}`}
          onCerrar={() => setVerParte(null)}
        >
          <p className="receta-detalle__pauta" style={{ marginBottom: 10 }}>
            {verParte.tipo_cirugia}
            {verParte.cirujano_apellido ? ` · Dr. ${verParte.cirujano_apellido}` : ''}
            {verParte.fecha_programada ? ` · ${verParte.fecha_programada}` : ''}
          </p>
          <pre className="informe-texto">{verParte.parte_quirurgico || 'Sin parte cargado.'}</pre>
        </Modal>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { Boton, TarjetaSeccion, EstadoVacio } from '../../components/ui';
import { useActualizacionTiempoReal } from '../../hooks';

const FILTROS = [
  { valor: 'todo', label: 'Todo' },
  { valor: 'evolucion', label: 'Evoluciones' },
  { valor: 'laboratorio', label: 'Laboratorio' },
  { valor: 'imagen', label: 'Imágenes' },
  { valor: 'receta', label: 'Recetas' },
  { valor: 'cirugia', label: 'Cirugías' },
];

const ESTILO = {
  evolucion: { chip: 'curso', titulo: 'Evolución clínica' },
  laboratorio: { chip: 'libre', titulo: 'Laboratorio' },
  imagen: { chip: 'libre', titulo: 'Imágenes' },
  receta: { chip: 'pendiente', titulo: 'Receta' },
  derivacion: { chip: 'curso', titulo: 'Derivación' },
  cirugia: { chip: 'urgente', titulo: 'Cirugía' },
};

/** Las alergias se guardan como lista JSON; se muestran legibles. */
function textoAlergias(valor) {
  if (!valor) return '';
  try {
    const l = typeof valor === 'string' ? JSON.parse(valor) : valor;
    return Array.isArray(l) ? l.filter(Boolean).join(', ') : String(l);
  } catch {
    return String(valor);
  }
}

function fechaLarga(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Historia clínica unificada.
 *
 * Reúne en una sola línea de tiempo todo lo que le pasó al paciente,
 * venga del módulo que venga. Es literalmente lo que inventó Plummer
 * en 1907: un expediente único por paciente en lugar de un cuaderno
 * separado por cada médico.
 */
export default function HistoriaClinica({ paciente, medicoId }) {
  const [hce, setHce] = useState(null);
  const [texto, setTexto] = useState('');
  const [filtro, setFiltro] = useState('todo');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!paciente) return;
    try {
      const d = await api.get(`/evoluciones/hce/${paciente.id}`);
      setHce(d);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [paciente]);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal(['evoluciones', 'estudios_laboratorio', 'estudios_imagenes', 'recetas', 'cirugias'], cargar);

  async function guardar(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setGuardando(true);
    setError('');
    try {
      await api.post('/evoluciones', { paciente_id: paciente.id, texto, medico_id: medicoId });
      setTexto('');
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!paciente) {
    return <EstadoVacio texto="Seleccioná un paciente desde su turno o desde las derivaciones recibidas." />;
  }

  // Se unifican todos los orígenes en una sola línea de tiempo.
  const eventos = [];
  if (hce) {
    hce.evoluciones.forEach((e) => eventos.push({
      tipo: 'evolucion', fecha: e.fecha_hora, id: e.id,
      autor: `Dr. ${e.medico_apellido} (${e.medico_especialidad})`,
      cuerpo: e.texto,
    }));
    hce.laboratorio.forEach((e) => eventos.push({
      tipo: 'laboratorio', fecha: e.completado_en || e.creado_en, id: e.id,
      autor: e.estado === 'realizado' ? 'Resultado disponible' : `Estado: ${e.estado}`,
      cuerpo: e.estudios.join(' · '), extra: e.resultado,
    }));
    hce.imagenes.forEach((e) => eventos.push({
      tipo: 'imagen', fecha: e.completado_en || e.creado_en, id: e.id,
      autor: e.tiene_imagen ? 'Con placa adjunta' : `Estado: ${e.estado}`,
      cuerpo: `${e.tipo_estudio}${e.region ? ` — ${e.region}` : ''}`, extra: e.informe,
    }));
    hce.recetas.forEach((e) => eventos.push({
      tipo: 'receta', fecha: e.creado_en, id: e.id,
      autor: `Dr. ${e.medico_apellido || '—'} · ${e.estado}`,
      cuerpo: `${e.medicamento}${e.dosis ? ` — ${e.dosis}` : ''}${e.frecuencia ? `, ${e.frecuencia}` : ''}`,
    }));
    hce.derivaciones.forEach((e) => eventos.push({
      tipo: 'derivacion', fecha: e.creado_en, id: e.id,
      autor: `${e.origen} → ${e.destino}${e.prioridad === 'urgente' ? ' · URGENTE' : ''}`,
      cuerpo: e.motivo || 'Sin motivo especificado',
    }));
    hce.cirugias.forEach((e) => eventos.push({
      tipo: 'cirugia', fecha: e.fecha_programada || e.creado_en, id: e.id,
      autor: `${e.estado}${e.cirujano_apellido ? ` · Dr. ${e.cirujano_apellido}` : ''}`,
      cuerpo: e.tipo_cirugia, extra: e.parte_quirurgico,
    }));
  }

  eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const visibles = filtro === 'todo' ? eventos : eventos.filter((e) => e.tipo === filtro);

  return (
    <div className="pila-secciones">
      {error && <div className="aviso-error">{error}</div>}

      {hce && (
        <div className="ficha-paciente surgir">
          <div>
            <p className="ficha-paciente__nombre">
              {hce.paciente.apellido}, {hce.paciente.nombre}
            </p>
            <p className="ficha-paciente__meta">
              DNI {hce.paciente.dni}
              {hce.paciente.grupo_sanguineo && hce.paciente.grupo_sanguineo !== 'desconocido'
                ? ` · Grupo ${hce.paciente.grupo_sanguineo} ${hce.paciente.factor_rh || ''}`
                : ''}
              {hce.paciente.cobertura_medica ? ` · ${hce.paciente.cobertura_medica}` : ''}
            </p>
          </div>
          <span className={`estado-chip estado-chip--${hce.paciente.estado === 'internado' ? 'curso' : 'libre'}`}>
            {hce.paciente.estado}
          </span>
        </div>
      )}

      {hce && textoAlergias(hce.paciente.alergias) && (
        <div className="aviso-alergia">
          Alergias registradas: {textoAlergias(hce.paciente.alergias)}
        </div>
      )}

      <TarjetaSeccion titulo="Nueva evolución" subtitulo="Queda firmada con tu nombre y matrícula">
        <form onSubmit={guardar} className="formulario">
          <textarea
            rows={5}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={'Motivo de consulta:\nExamen físico:\nDiagnóstico presuntivo:\nConducta:'}
          />
          <div className="formulario__acciones">
            <Boton type="submit" disabled={guardando || !texto.trim()}>
              {guardando ? 'Guardando…' : 'Guardar evolución'}
            </Boton>
          </div>
        </form>
      </TarjetaSeccion>

      <TarjetaSeccion
        titulo="Historia clínica unificada"
        subtitulo={`${eventos.length} registros de todos los módulos`}
        acciones={
          <div className="mini-tabs">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                className={`mini-tab ${filtro === f.valor ? 'mini-tab--activo' : ''}`}
                onClick={() => setFiltro(f.valor)}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {visibles.length === 0 ? (
          <EstadoVacio texto="No hay registros para este filtro." />
        ) : (
          <div className="linea-tiempo">
            {visibles.map((ev) => {
              const est = ESTILO[ev.tipo] || ESTILO.evolucion;
              return (
                <article key={`${ev.tipo}-${ev.id}`} className="hito surgir">
                  <div className={`hito__punto hito__punto--${est.chip}`} />
                  <div className="hito__cuerpo">
                    <div className="hito__cabecera">
                      <span className={`estado-chip estado-chip--${est.chip}`}>{est.titulo}</span>
                      <span className="hito__fecha">{fechaLarga(ev.fecha)}</span>
                    </div>
                    <p className="hito__autor">{ev.autor}</p>
                    <p className="hito__texto">{ev.cuerpo}</p>
                    {ev.extra && <pre className="informe-texto">{ev.extra}</pre>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </TarjetaSeccion>
    </div>
  );
}

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Boton, TarjetaSeccion, EstadoVacio } from '../../components/ui';
import { useActualizacionTiempoReal, useDestelloActualizacion } from '../../hooks';

const ETAPAS = [
  { valor: 'pendiente', label: 'Pendiente', chip: 'pendiente' },
  { valor: 'en_sala', label: 'En sala', chip: 'curso' },
  { valor: 'realizado', label: 'Realizado', chip: 'curso' },
  { valor: 'informado', label: 'Informado', chip: 'libre' },
  { valor: 'entregado', label: 'Entregado', chip: 'inactivo' },
];

const NOMBRE_ORIGEN = {
  medico: 'Consultorio', recepcion: 'Recepción', guardia: 'Guardia',
  enfermeria: 'Internación', quirofano: 'Quirófano',
};

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

/**
 * Comprime la imagen en el navegador antes de subirla.
 * La placa se guarda dentro de PostgreSQL porque el disco de Render se
 * borra en cada reinicio; comprimirla evita cargar la base de más.
 */
function comprimirImagen(archivo, ladoMax = 1100, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        const ctx = lienzo.getContext('2d');
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        resolve(lienzo.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = lector.result;
    };
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
  });
}

export default function EstudiosImagenes() {
  const [estudios, setEstudios] = useState([]);
  const [metricas, setMetricas] = useState({});
  const [plantillas, setPlantillas] = useState({});
  const [informando, setInformando] = useState(null);
  const [texto, setTexto] = useState('');
  const [verEstudio, setVerEstudio] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef(null);
  const { destellar, claseDe } = useDestelloActualizacion();

  const cargar = useCallback(async () => {
    try {
      const [e, m] = await Promise.all([
        api.get('/imagenes'),
        api.get('/imagenes/metricas').catch(() => ({})),
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
    api.get('/imagenes/catalogo').then((c) => setPlantillas(c.plantillas || {})).catch(() => {});
  }, [cargar]);

  useActualizacionTiempoReal('estudios_imagenes', cargar);

  function abrirInforme(est) {
    setInformando(est);
    setError('');
    setTexto(est.informe || plantillas[est.tipo_estudio] || '');
  }

  async function guardarInforme(e) {
    e.preventDefault();
    setError('');
    if (!texto.trim()) {
      setError('El informe no puede estar vacío.');
      return;
    }
    try {
      await api.patch(`/imagenes/${informando.id}/informe`, { informe: texto });
      destellar(informando.id);
      setInformando(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function cambiarEstado(id, estado) {
    setError('');
    try {
      await api.patch(`/imagenes/${id}/estado`, { estado });
      destellar(id);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function subirImagen(est, archivo) {
    if (!archivo) return;
    setError('');
    setSubiendo(true);
    try {
      const datos = await comprimirImagen(archivo);
      await api.patch(`/imagenes/${est.id}/imagen`, { imagen_datos: datos });
      destellar(est.id);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  const filtrados = estudios.filter((e) => {
    if (!busqueda.trim()) return true;
    const t = busqueda.toLowerCase();
    return (
      `${e.paciente_apellido} ${e.paciente_nombre}`.toLowerCase().includes(t) ||
      String(e.paciente_dni || '').includes(t) ||
      `${e.tipo_estudio} ${e.region || ''}`.toLowerCase().includes(t)
    );
  });

  const pendientes = filtrados.filter((e) => !['informado', 'entregado'].includes(e.estado));
  const listos = filtrados.filter((e) => ['informado', 'entregado'].includes(e.estado));

  return (
    <div className="pila-secciones">
      {error && <div className="aviso-error">{error}</div>}

      <div className="metricas">
        {[
          { l: 'Pendientes', v: metricas.pendientes, c: 'pendiente' },
          { l: 'En sala', v: metricas.en_sala, c: 'curso' },
          { l: 'Urgentes', v: metricas.urgentes, c: 'urgente' },
          { l: 'Informados hoy', v: metricas.informados_hoy, c: 'libre' },
        ].map((m) => (
          <div key={m.l} className={`metrica metrica--${m.c} surgir`}>
            <p className="metrica__valor">{m.v ?? 0}</p>
            <p className="metrica__label">{m.l}</p>
          </div>
        ))}
      </div>

      <TarjetaSeccion
        titulo="Solicitudes recibidas"
        subtitulo="Qué estudio hacer, en qué región y quién lo pidió"
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
                        DNI {e.paciente_dni} · pedido por {e.solicitado_por}
                        {e.origen_modulo ? ` (${NOMBRE_ORIGEN[e.origen_modulo] || e.origen_modulo})` : ''}
                        {' · '}{cuandoFue(e.creado_en)}
                      </p>
                    </div>
                    <span className={`estado-chip estado-chip--${e.prioridad === 'urgente' ? 'urgente' : et.chip}`}>
                      {e.prioridad === 'urgente' ? 'Urgente' : et.label}
                    </span>
                  </div>

                  <div className="receta-detalle">
                    <p className="receta-detalle__medicamento">
                      {e.tipo_estudio}{e.region ? ` — ${e.region}` : ''}
                    </p>
                    {e.indicaciones && (
                      <p className="receta-detalle__indicaciones">Motivo: {e.indicaciones}</p>
                    )}
                  </div>

                  {e.imagen_datos && (
                    <img className="placa-miniatura" src={e.imagen_datos} alt="Placa del estudio" />
                  )}

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
                    <div className="tarjeta-derivacion__botones">
                      <label className="boton boton--secundario boton--archivo">
                        {subiendo ? 'Subiendo…' : e.imagen_datos ? 'Cambiar placa' : 'Adjuntar placa'}
                        <input
                          ref={archivoRef}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(ev) => subirImagen(e, ev.target.files[0])}
                        />
                      </label>
                      <Boton onClick={() => abrirInforme(e)}>Cargar informe</Boton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </TarjetaSeccion>

      {listos.length > 0 && (
        <TarjetaSeccion titulo="Informados" subtitulo={`${listos.length} estudios con informe cargado`}>
          <div className="lista-derivaciones">
            {listos.slice(0, 12).map((e) => (
              <article key={e.id} className={`tarjeta-derivacion ${claseDe(e.id)}`}>
                <div className="tarjeta-derivacion__cabecera">
                  <div>
                    <p className="tarjeta-derivacion__paciente">
                      {e.paciente_apellido}, {e.paciente_nombre}
                    </p>
                    <p className="tarjeta-derivacion__meta">
                      {e.tipo_estudio}{e.region ? ` — ${e.region}` : ''} · {cuandoFue(e.completado_en)}
                    </p>
                  </div>
                  <span className={`estado-chip estado-chip--${etapaDe(e.estado).chip}`}>
                    {etapaDe(e.estado).label}
                  </span>
                </div>
                <div className="tarjeta-derivacion__pie">
                  <span />
                  <div className="tarjeta-derivacion__botones">
                    <Boton variante="secundario" onClick={() => setVerEstudio(e)}>Ver informe</Boton>
                    {e.estado === 'informado' && (
                      <Boton variante="secundario" onClick={() => cambiarEstado(e.id, 'entregado')}>
                        Marcar entregado
                      </Boton>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </TarjetaSeccion>
      )}

      {informando && (
        <Modal
          abierto
          ancho={700}
          titulo={`Informe — ${informando.paciente_apellido}, ${informando.paciente_nombre}`}
          onCerrar={() => setInformando(null)}
        >
          <form onSubmit={guardarInforme} className="formulario">
            {error && <div className="aviso-error">{error}</div>}
            <div className="receta-fijada">
              <p className="receta-fijada__label">Estudio solicitado</p>
              <p className="receta-fijada__valor">
                {informando.tipo_estudio}{informando.region ? ` — ${informando.region}` : ''}
              </p>
              {informando.indicaciones && (
                <p className="receta-fijada__meta">Motivo: {informando.indicaciones}</p>
              )}
            </div>

            {informando.imagen_datos && (
              <img className="placa-grande" src={informando.imagen_datos} alt="Placa del estudio" />
            )}

            <label className="campo">
              <span className="campo__label">Informe</span>
              <textarea rows={11} value={texto} onChange={(ev) => setTexto(ev.target.value)} />
            </label>

            <div className="formulario__acciones">
              <Boton variante="secundario" type="button" onClick={() => setInformando(null)}>Cancelar</Boton>
              <Boton type="submit">Guardar y avisar</Boton>
            </div>
          </form>
        </Modal>
      )}

      {verEstudio && (
        <Modal
          abierto
          ancho={700}
          titulo={`${verEstudio.paciente_apellido}, ${verEstudio.paciente_nombre}`}
          onCerrar={() => setVerEstudio(null)}
        >
          <p className="receta-detalle__pauta" style={{ marginBottom: 10 }}>
            {verEstudio.tipo_estudio}{verEstudio.region ? ` — ${verEstudio.region}` : ''}
          </p>
          {verEstudio.imagen_datos && (
            <img className="placa-grande" src={verEstudio.imagen_datos} alt="Placa del estudio" />
          )}
          <pre className="informe-texto">{verEstudio.informe}</pre>
        </Modal>
      )}
    </div>
  );
}

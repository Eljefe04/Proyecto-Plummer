import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { Boton, TarjetaSeccion, EstadoVacio } from './ui';
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
      setError('');
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinos.join(',')]);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal(['derivaciones', 'guardia'], cargar);

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

  const pendientes = derivaciones.filter((d) => d.estado !== 'atendida');
  const atendidas = derivaciones.filter((d) => d.estado === 'atendida');

  return (
    <div className="pila-secciones">
      {error && <div className="aviso-error">{error}</div>}

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
                    <span className="estado-chip estado-chip--inactivo">
                      {d.paciente_estado === 'internado' ? 'Internado' : 'Ambulatorio'}
                    </span>
                  )}
                  <div className="tarjeta-derivacion__botones">
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

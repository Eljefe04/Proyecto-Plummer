import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import { TarjetaSeccion, EstadoVacio } from '../../components/ui';
import BandejaDerivaciones from '../../components/BandejaDerivaciones';
import { useActualizacionTiempoReal, useDestelloActualizacion } from '../../hooks';

const NOMBRE_DESTINO = {
  internacion: 'Internación',
  terapia_intensiva: 'Terapia Intensiva',
  guardia: 'Guardia',
};

const COLOR_TRIAGE = ['', 'urgente', 'urgente', 'pendiente', 'curso', 'libre'];

function cuandoFue(iso) {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-AR');
}

export default function DerivacionesEnfermeria() {
  const [derivaciones, setDerivaciones] = useState([]);
  const [guardia, setGuardia] = useState([]);
  const [error, setError] = useState('');
  const { destellar, claseDe } = useDestelloActualizacion();

  const cargar = useCallback(async () => {
    try {
      const [d, g] = await Promise.all([
        api.get('/derivaciones/enfermeria'),
        api.get('/guardia'),
      ]);
      setDerivaciones(d);
      setGuardia(g);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal(['derivaciones', 'guardia', 'camas', 'internados'], cargar);

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

      <BandejaDerivaciones
        destinos={['internacion', 'terapia_intensiva', 'guardia']}
        titulo="Derivaciones recibidas"
        subtitulo="Pacientes derivados a Internación, Terapia Intensiva o Guardia"
      />

      <TarjetaSeccion
        titulo="Sala de guardia"
        subtitulo="Ingresos ordenados por nivel de triage: el 1 se atiende primero"
      >
        {guardia.length === 0 ? (
          <EstadoVacio texto="No hay pacientes en guardia en este momento." />
        ) : (
          <div className="lista-derivaciones">
            {guardia.map((g) => (
              <article
                key={g.id}
                className={`tarjeta-derivacion surgir ${
                  Number(g.nivel_triage) <= 2 ? 'tarjeta-derivacion--urgente' : ''
                }`}
              >
                <div className="tarjeta-derivacion__cabecera">
                  <div>
                    <p className="tarjeta-derivacion__paciente">
                      {g.protocolo_nn
                        ? g.nombre_temporal || 'Paciente NN'
                        : `${g.paciente_apellido}, ${g.paciente_nombre}`}
                    </p>
                    <p className="tarjeta-derivacion__meta">
                      {g.protocolo_nn ? 'Protocolo NN' : `DNI ${g.paciente_dni}`} ·{' '}
                      {String(g.medio_transporte).replace('_', ' ')} · {cuandoFue(g.creado_en)}
                    </p>
                  </div>
                  <span className={`estado-chip estado-chip--${COLOR_TRIAGE[g.nivel_triage] || 'curso'}`}>
                    Triage {g.nivel_triage}
                  </span>
                </div>

                <p className="tarjeta-derivacion__motivo">{g.motivo_consulta}</p>

                {g.signos_vitales && (
                  <p className="tarjeta-derivacion__meta">Signos: {g.signos_vitales}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </TarjetaSeccion>

    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api';
import Modal from '../../components/Modal';
import { Badge, Boton, TarjetaSeccion, EstadoVacio, Campo } from '../../components/ui';
import { useActualizacionTiempoReal } from '../../hooks';

const TIPOS_REGISTRO = [
  { valor: 'signos_vitales', label: 'Signos Vitales' },
  { valor: 'medicacion_administrada', label: 'Medicación Administrada' },
  { valor: 'nota_evolucion', label: 'Nota de Evolución' },
];

export default function PacientesInternados() {
  const [internados, setInternados] = useState([]);
  const [pacienteAbierto, setPacienteAbierto] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [modalRegistro, setModalRegistro] = useState(false);
  const [tipo, setTipo] = useState('signos_vitales');
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    api.get('/enfermeria/pacientes-internados').then(setInternados).catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useActualizacionTiempoReal(['camas', 'guardia', 'internados', 'derivaciones'], cargar);

  function abrirPaciente(p) {
    setPacienteAbierto(p);
    api.get(`/enfermeria/registros/${p.id}`).then(setRegistros).catch(() => setRegistros([]));
  }

  async function registrar(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/enfermeria/registros', { paciente_id: pacienteAbierto.id, tipo, detalle });
      setModalRegistro(false);
      setDetalle('');
      api.get(`/enfermeria/registros/${pacienteAbierto.id}`).then(setRegistros);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <TarjetaSeccion titulo={`Pacientes Internados — ${internados.length}`}>
      {internados.length === 0 ? (
        <EstadoVacio texto="No hay pacientes internados en este momento." />
      ) : (
        <div className="grid-medicos">
          {internados.map((p) => (
            <div key={p.id} className="tarjeta-medico" style={{ cursor: 'pointer' }} onClick={() => abrirPaciente(p)}>
              <div className="tarjeta-medico__header">
                <div className="tarjeta-medico__avatar">{p.nombre.charAt(0)}{p.apellido.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="tarjeta-medico__nombre">{p.nombre} {p.apellido}</p>
                  <p className="tarjeta-medico__matricula">DNI {p.dni}</p>
                </div>
                <Badge tipo="info">{p.cama_codigo}</Badge>
              </div>
              <div className="tarjeta-medico__detalle">
                <p style={{ textTransform: 'capitalize' }}>{p.cama_sector?.replace('_', ' ')}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        titulo={pacienteAbierto ? `${pacienteAbierto.nombre} ${pacienteAbierto.apellido} — Cama ${pacienteAbierto.cama_codigo}` : ''}
        abierto={!!pacienteAbierto}
        onCerrar={() => setPacienteAbierto(null)}
        ancho={640}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <Boton onClick={() => { setTipo('signos_vitales'); setDetalle(''); setError(''); setModalRegistro(true); }}>
            + Nuevo registro
          </Boton>
        </div>

        {registros.length === 0 ? (
          <EstadoVacio texto="Sin registros de enfermería todavía." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {registros.map((r) => (
              <div key={r.id} style={{ border: '1px solid var(--borde-suave)', borderRadius: 'var(--radio-sm)', padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Badge tipo="info">{TIPOS_REGISTRO.find((t) => t.valor === r.tipo)?.label || r.tipo}</Badge>
                  <span style={{ fontSize: 12, color: 'var(--texto-secundario)' }}>{r.creado_en}</span>
                </div>
                <p style={{ fontSize: 13.5 }}>{r.detalle}</p>
                <p style={{ fontSize: 11.5, color: 'var(--texto-secundario)', marginTop: 4 }}>Registrado por {r.registrado_por}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal titulo="Nuevo registro de enfermería" abierto={modalRegistro} onCerrar={() => setModalRegistro(false)} ancho={480}>
        <form onSubmit={registrar}>
          <Campo label="Tipo de registro">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_REGISTRO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
            </select>
          </Campo>
          <Campo label={tipo === 'signos_vitales' ? 'TA, FC, FR, T°, Sat O2' : tipo === 'medicacion_administrada' ? 'Medicación y horario' : 'Nota de evolución'}>
            <textarea rows={4} required value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          </Campo>
          {error && <p className="form-error">{error}</p>}
          <div className="form-acciones">
            <Boton variante="secundario" type="button" onClick={() => setModalRegistro(false)}>Cancelar</Boton>
            <Boton type="submit">Guardar registro</Boton>
          </div>
        </form>
      </Modal>
    </TarjetaSeccion>
  );
}

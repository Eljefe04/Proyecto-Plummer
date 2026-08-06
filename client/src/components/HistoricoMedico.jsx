import { useEffect, useState } from 'react';
import { api } from '../api';
import './HistoricoMedico.css';

export default function HistoricoMedico({ especialidad }) {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    api
      .get(`/medicos-historicos/${especialidad}`)
      .then((d) => {
        if (activo) setData(d);
      })
      .catch(() => {
        if (activo) setData(null);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [especialidad]);

  if (cargando) {
    return <div className="historico historico--cargando" aria-hidden="true" />;
  }
  if (!data) return null;

  return (
    <aside className="historico" aria-label={`Referente histórico de ${especialidad}`}>
      <div className="historico__marco">
        <img
          className="historico__foto"
          src={data.imagen}
          alt={data.nombre}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement.classList.add('historico__marco--sin-foto');
          }}
        />
      </div>
      <div className="historico__texto">
        <p className="historico__eyebrow">Referente de la especialidad</p>
        <h3 className="historico__nombre">{data.nombre}</h3>
        <p className="historico__anios">{data.anios}</p>
        <p className="historico__bio">{data.bio}</p>
      </div>
    </aside>
  );
}

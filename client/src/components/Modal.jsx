import { useEffect } from 'react';
import './Modal.css';

export default function Modal({ titulo, abierto, onCerrar, children, ancho = 560 }) {
  useEffect(() => {
    function onEsc(e) {
      if (e.key === 'Escape') onCerrar();
    }
    if (abierto) document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="modal__overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="modal__caja" style={{ maxWidth: ancho }} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal__header">
          <h3>{titulo}</h3>
          <button className="modal__cerrar" onClick={onCerrar} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="modal__contenido">{children}</div>
      </div>
    </div>
  );
}

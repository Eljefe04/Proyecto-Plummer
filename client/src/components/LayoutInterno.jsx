import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotificacionesTiempoReal } from '../hooks';
import LogoPlummer from './LogoPlummer';
import './LayoutInterno.css';

export default function LayoutInterno({ titulo, menu, children }) {
  const { usuario, logout } = useAuth();
  const { toast, cerrarToast } = useNotificacionesTiempoReal();

  return (
    <div className="layout">
      <aside className="layout__sidebar">
        <div className="layout__marca">
          <LogoPlummer size={36} />
          <div>
            <p className="layout__marca-nombre">Proyecto Plummer</p>
            <p className="layout__marca-sub">Mayo Clinic BA</p>
          </div>
        </div>

        <nav className="layout__nav">
          {menu.map((grupo) => (
            <div key={grupo.titulo} className="layout__nav-grupo">
              <p className="layout__nav-grupo-titulo">{grupo.titulo}</p>
              {grupo.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `layout__nav-item ${isActive ? 'layout__nav-item--activo' : ''}`}
                  end={item.exact}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="layout__usuario">
          <div className="layout__usuario-avatar">{usuario?.nombreCompleto?.charAt(0)}</div>
          <div className="layout__usuario-datos">
            <p className="layout__usuario-nombre">{usuario?.nombreCompleto}</p>
            <p className="layout__usuario-rol">{usuario?.rol}</p>
          </div>
          <button className="layout__usuario-salir" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="layout__contenido">
        <header className="layout__topbar">
          <h1>{titulo}</h1>
        </header>
        <div className="layout__body">{children}</div>
      </main>

      {toast && (
        <div className="layout__toast" role="status">
          <div className="layout__toast-icono">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </div>
          <div>
            <p className="layout__toast-titulo">{toast.titulo}</p>
            <p className="layout__toast-mensaje">{toast.mensaje}</p>
          </div>
          <button className="layout__toast-cerrar" onClick={cerrarToast} aria-label="Cerrar notificación">×</button>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CampanaNotificaciones from './CampanaNotificaciones';
import LogoPlummer from './LogoPlummer';
import './LayoutInterno.css';

function horaCorta(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function LayoutInterno({ titulo, menu, children }) {
  const { usuario, logout } = useAuth();
  const [cajonAbierto, setCajonAbierto] = useState(false);

  // Los primeros accesos del menu, para la barra inferior del celular.
  const accesosMoviles = menu.flatMap((g) => g.items).slice(0, 5);

  return (
    <div className="layout">
      {cajonAbierto && (
        <div className="layout__velo solo-movil" onClick={() => setCajonAbierto(false)} />
      )}

      <aside className={`layout__sidebar layout__lateral ${cajonAbierto ? 'layout__lateral--abierta' : ''}`}>
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
                  onClick={() => setCajonAbierto(false)}
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
          <button
            className="layout__hamburguesa solo-movil"
            onClick={() => setCajonAbierto(true)}
            aria-label="Abrir menú"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <h1>{titulo}</h1>

          {/* ----------------------------------------------------------
              CAMPANA
              Antes solo existia el toast: duraba 6 segundos y la
              notificacion se perdia para siempre. El historial ya se
              cargaba de la API pero no se mostraba en ningun lado.
              ---------------------------------------------------------- */}
          <div className="layout__acciones">
            <CampanaNotificaciones />
          </div>
        </header>

        <div className="layout__body">{children}</div>
      </main>

      {/* Barra inferior de navegación: solo en celular */}
      <nav className="nav-movil" aria-label="Navegación rápida">
        {accesosMoviles.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `nav-movil__item ${isActive ? 'nav-movil__item--activo' : ''}`}
          >
            <span className="nav-movil__icono">•</span>
            <span>{item.label.length > 11 ? `${item.label.slice(0, 10)}…` : item.label}</span>
          </NavLink>
        ))}
      </nav>

    </div>
  );
}

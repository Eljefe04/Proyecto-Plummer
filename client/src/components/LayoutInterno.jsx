import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotificacionesTiempoReal } from '../hooks';
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
  const { notificaciones, sinLeer, marcarLeidas, toast, cerrarToast } = useNotificacionesTiempoReal();

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [cajonAbierto, setCajonAbierto] = useState(false);
  const [sacudiendo, setSacudiendo] = useState(false);
  const contenedorCampana = useRef(null);
  const anteriorSinLeer = useRef(0);

  // La campana se sacude cuando entra algo nuevo.
  useEffect(() => {
    if (sinLeer > anteriorSinLeer.current) {
      setSacudiendo(true);
      const t = setTimeout(() => setSacudiendo(false), 650);
      return () => clearTimeout(t);
    }
    anteriorSinLeer.current = sinLeer;
  }, [sinLeer]);

  // Cerrar el panel al hacer clic afuera.
  useEffect(() => {
    if (!panelAbierto) return;
    function alClic(e) {
      if (contenedorCampana.current && !contenedorCampana.current.contains(e.target)) {
        setPanelAbierto(false);
      }
    }
    document.addEventListener('mousedown', alClic);
    return () => document.removeEventListener('mousedown', alClic);
  }, [panelAbierto]);

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
          <div className="layout__acciones" ref={contenedorCampana}>
            <button
              className={`campana ${sacudiendo ? 'campana--suena' : ''}`}
              onClick={() => {
                setPanelAbierto((v) => !v);
                if (!panelAbierto) marcarLeidas();
              }}
              aria-label={`Notificaciones${sinLeer ? ` (${sinLeer} sin leer)` : ''}`}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {sinLeer > 0 && <span className="campana__contador">{sinLeer > 9 ? '9+' : sinLeer}</span>}
            </button>

            {panelAbierto && (
              <div className="panel-notificaciones">
                {notificaciones.length === 0 ? (
                  <p className="panel-notificaciones__vacio">No hay notificaciones todavía.</p>
                ) : (
                  notificaciones.map((n) => (
                    <div
                      key={n.id}
                      className={`panel-notificaciones__item ${n.prioridad === 'urgente' ? 'panel-notificaciones__item--urgente' : ''}`}
                    >
                      <p className="panel-notificaciones__titulo">{n.titulo}</p>
                      <p className="panel-notificaciones__mensaje">{n.mensaje}</p>
                      <p className="panel-notificaciones__hora">{horaCorta(n.creado_en)}</p>
                    </div>
                  ))
                )}
              </div>
            )}
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

      {toast && (
        <div className={`layout__toast ${toast.prioridad === 'urgente' ? 'layout__toast--urgente' : ''}`} role="status">
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

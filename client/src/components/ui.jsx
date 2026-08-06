import './ui.css';

export function Badge({ tipo = 'neutro', children }) {
  return <span className={`badge badge--${tipo}`}>{children}</span>;
}

export function Boton({ variante = 'primario', tamano = 'md', children, ...props }) {
  return (
    <button className={`boton boton--${variante} boton--${tamano}`} {...props}>
      {children}
    </button>
  );
}

export function TarjetaSeccion({ titulo, acciones, children }) {
  return (
    <section className="tarjeta-seccion">
      {(titulo || acciones) && (
        <div className="tarjeta-seccion__header">
          {titulo && <h2>{titulo}</h2>}
          {acciones && <div className="tarjeta-seccion__acciones">{acciones}</div>}
        </div>
      )}
      <div className="tarjeta-seccion__cuerpo">{children}</div>
    </section>
  );
}

export function EstadoVacio({ texto }) {
  return <p className="estado-vacio">{texto}</p>;
}

export function Campo({ label, children, ancho }) {
  return (
    <div className="campo" style={ancho ? { gridColumn: `span ${ancho}` } : undefined}>
      <label>{label}</label>
      {children}
    </div>
  );
}

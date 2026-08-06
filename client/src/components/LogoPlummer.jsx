export default function LogoPlummer({ size = 48, variante = 'sobre-oscuro' }) {
  const colorTrazo = variante === 'sobre-oscuro' ? '#F4F7FA' : '#0B3D62';
  const colorFondo = variante === 'sobre-oscuro' ? 'rgba(244,247,250,0.12)' : '#EAF2F9';
  const colorAcento = '#2FA88C';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Logo Proyecto Plummer"
    >
      <rect x="1" y="1" width="62" height="62" rx="16" fill={colorFondo} stroke={colorTrazo} strokeOpacity="0.18" />
      <path
        d="M8 34 H20 L25 20 L32 46 L38 28 L42 34 H56"
        stroke={colorTrazo}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="42" cy="34" r="3.2" fill={colorAcento} />
    </svg>
  );
}

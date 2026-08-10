/**
 * Marca del Proyecto Plummer.
 *
 * Cuenta algo concreto: tres fichas sueltas que se apilan en un
 * registro unico. Son los cuadernos separados que cada medico llevaba
 * por su cuenta antes de 1907, convirtiendose en el expediente
 * unificado por paciente. Es, literalmente, lo que invento Plummer.
 */
export default function LogoPlummer({ size = 40, animado = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Proyecto Plummer"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <defs>
        <linearGradient id="lp-azul" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12508f" />
          <stop offset="1" stopColor="#0a2f5c" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#lp-azul)" />

      {/* Las fichas sueltas que se van apilando */}
      <rect x="24" y="26" width="52" height="48" rx="7" fill="#ffffff" opacity="0.16" />
      <rect x="28" y="31" width="52" height="48" rx="7" fill="#ffffff" opacity="0.28" />

      {/* El registro unificado */}
      <rect x="32" y="36" width="52" height="48" rx="7" fill="#ffffff" />
      <path d="M55 46h6v9h9v6h-9v9h-6v-9h-9v-6h9z" fill="#12508f" />

      {/* Pulso que lo atraviesa */}
      <path
        d="M10 62h13l6-13 8 26 6-13h5"
        fill="none"
        stroke="#2fd39e"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          animado
            ? {
                '--largo-trazo': 70,
                strokeDasharray: 70,
                animation: 'trazo-ecg 1.6s cubic-bezier(0.4,0,0.2,1) 0.3s both',
              }
            : undefined
        }
      />
    </svg>
  );
}

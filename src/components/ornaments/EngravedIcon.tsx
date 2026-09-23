/**
 * Ícones de linha no estilo gravura (48 × 48, traço fino, `currentColor`).
 * Usados na lista de presentes e em pontos do portal — nunca ícones "de app".
 */
const ICONS: Record<string, React.ReactNode> = {
  tacas: (
    <>
      <path d="M11 7 H19 L17.6 20 C17.2 24 12.8 24 12.4 20 Z" />
      <path d="M15 23.5 V37 M11 38 H19" />
      <path d="M12 12 H18" className="ei-thin" />
      <g transform="rotate(14 33 24)">
        <path d="M29 7 H37 L35.6 20 C35.2 24 30.8 24 30.4 20 Z" />
        <path d="M33 23.5 V37 M29 38 H37" />
        <path d="M30 12 H36" className="ei-thin" />
      </g>
      <path d="M24 4 V8 M21 6 H27 M22 4.5 L26 7.5 M26 4.5 L22 7.5" className="ei-thin" />
      <circle cx="14" cy="16" r="0.9" className="ei-dot" />
      <circle cx="16.5" cy="13.5" r="0.7" className="ei-dot" />
    </>
  ),
  jantar: (
    <>
      <path d="M9 32 C9 21 15.5 14.5 24 14.5 C32.5 14.5 39 21 39 32" />
      <path d="M13 29 C13.5 23 17.5 19 22 18" className="ei-thin" />
      <path d="M5 34.5 H43" />
      <path d="M8 37.5 H40" className="ei-thin" />
      <circle cx="24" cy="12" r="2.4" />
      <path d="M22 32 H26" className="ei-thin" />
    </>
  ),
  cafe: (
    <>
      <path d="M11 20 H31 V27 C31 33.5 27 37.5 21 37.5 C15 37.5 11 33.5 11 27 Z" />
      <path d="M31 22.5 C37 22.5 37 31 31 31" />
      <path d="M6 40.5 H36" />
      <path d="M9 43 H33" className="ei-thin" />
      <path d="M17 16 C15 13 19 11 17 7.5 M22 16 C20 13 24 11 22 7.5 M27 16 C25 13 29 11 27 7.5" className="ei-thin" />
    </>
  ),
  aviao: (
    <>
      <path d="M5 23 L43 9 L32 39 L24 29 Z" />
      <path d="M24 29 L43 9 M24 29 L22 37 L27.5 33.5" />
      <path d="M5 23 L24 29" className="ei-thin" />
      <path d="M4 34 C8 32 11 34 14 32 M6 40 C10 38 14 40 18 37.5" className="ei-thin ei-dash" />
    </>
  ),
  mala: (
    <>
      <rect x="8" y="16" width="32" height="23" rx="3" />
      <path d="M19 16 V11.5 H29 V16" />
      <path d="M15 16 V39 M33 16 V39" className="ei-thin" />
      <path d="M8 26 H40" className="ei-thin" />
      <circle cx="12" cy="41" r="1.6" />
      <circle cx="36" cy="41" r="1.6" />
    </>
  ),
  chave: (
    <>
      <circle cx="15" cy="24" r="7.5" />
      <circle cx="15" cy="24" r="3" className="ei-thin" />
      <path d="M22.5 24 H42" />
      <path d="M35 24 V30 M39.5 24 V28.5" />
      <path d="M8.5 17.5 C6 14 9 11 11.5 13" className="ei-thin" />
    </>
  ),
  mapa: (
    <>
      <path d="M6 12 L17 8 L31 12 L42 8 V36 L31 40 L17 36 L6 40 Z" />
      <path d="M17 8 V36 M31 12 V40" className="ei-thin" />
      <path d="M10 31 C15 28 17 22 22 23 C27 24 27 18 33 17" className="ei-thin ei-dash" />
      <path d="M34.5 14.5 L38 18 M38 14.5 L34.5 18" />
    </>
  ),
  estrela: (
    <>
      <path d="M24 6 L28.8 17.8 L41.5 18.6 L31.7 26.7 L34.9 39 L24 32.2 L13.1 39 L16.3 26.7 L6.5 18.6 L19.2 17.8 Z" />
      <path d="M24 12 L26.9 19.9 L34.6 20.3 L28.7 25.3 L30.6 32.8 L24 28.6" className="ei-thin" />
    </>
  ),
  casa: (
    <>
      <path d="M6 23 L24 8.5 L42 23" />
      <path d="M11 20 V39 H37 V20" />
      <path d="M20.5 39 V29.5 C20.5 27.5 22 26.5 24 26.5 C26 26.5 27.5 27.5 27.5 29.5 V39" />
      <rect x="13.5" y="24" width="4.5" height="5" className="ei-thin" />
      <rect x="30" y="24" width="4.5" height="5" className="ei-thin" />
      <path d="M31 12.5 V8 H35 V15.8" />
      <path d="M4 42 H44" className="ei-thin" />
    </>
  ),
  prato: (
    <>
      <circle cx="24" cy="25" r="11" />
      <circle cx="24" cy="25" r="7" className="ei-thin" />
      <path d="M7.5 11 V38 M5.5 11 V17 C5.5 19.5 9.5 19.5 9.5 17 V11" />
      <path d="M40.5 11 C44 15 44 21 40.5 23.5 V38" />
    </>
  ),
  lua: (
    <>
      <path d="M29 9 C20 10.5 15 18 16.5 26.5 C18 35 27.5 40.5 36 36.5 C27.5 36 22 30 22 22.5 C22 16.5 24.5 12 29 9 Z" />
      <path d="M36 12 V17 M33.5 14.5 H38.5" className="ei-thin" />
      <path d="M40 22 V25 M38.5 23.5 H41.5" className="ei-thin" />
      <circle cx="10" cy="14" r="0.9" className="ei-dot" />
    </>
  ),
  vinho: (
    <>
      <path d="M12 41 V24 C12 20 15.5 18.5 15.5 14 V7 H19.5 V14 C19.5 18.5 23 20 23 24 V41 Z" />
      <rect x="13.5" y="27" width="8" height="8" className="ei-thin" />
      <path d="M29 19 H40 C40 26.5 37 29.5 34.5 29.5 C32 29.5 29 26.5 29 19 Z" />
      <path d="M34.5 29.5 V39 M30.5 39.5 H38.5" />
      <path d="M30 23 C33 24 36 22 39.5 23" className="ei-thin" />
    </>
  ),
  vaso: (
    <>
      <path d="M17 41 C12.5 35 13 28.5 17.5 25 H30.5 C35 28.5 35.5 35 31 41 Z" />
      <path d="M16 25 H32" />
      <path d="M24 25 V13 M24 24 C22 18 17 16.5 12.5 16.5 M24 24 C26 18 31 16.5 35.5 16.5" className="ei-thin" />
      <circle cx="24" cy="10.5" r="2.6" />
      <circle cx="11" cy="15.5" r="2.2" />
      <circle cx="37" cy="15.5" r="2.2" />
      <path d="M17 33 H31" className="ei-thin" />
    </>
  ),
  camera: (
    <>
      <rect x="6" y="15" width="36" height="23" rx="3" />
      <path d="M15 15 L18.5 10 H29.5 L33 15" />
      <circle cx="24" cy="26.5" r="7.5" />
      <circle cx="24" cy="26.5" r="4" className="ei-thin" />
      <rect x="9" y="18" width="5" height="3" className="ei-thin" />
      <circle cx="37" cy="19.5" r="1" className="ei-dot" />
    </>
  ),
  presente: (
    <>
      <rect x="10" y="22" width="28" height="18" />
      <rect x="8" y="17" width="32" height="5" />
      <path d="M24 17 V40" />
      <path d="M24 17 C20 9.5 12.5 11.5 15.5 15.5 C17.5 17.5 21.5 17 24 17 C26.5 17 30.5 17.5 32.5 15.5 C35.5 11.5 28 9.5 24 17 Z" />
      <path d="M10 30 H38" className="ei-thin" />
    </>
  ),
  coracao: (
    <>
      <path d="M24 39 C14 31 8 25 8 17.5 C8 12.5 11.8 9 16.2 9 C19.8 9 22.2 11 24 14 C25.8 11 28.2 9 31.8 9 C36.2 9 40 12.5 40 17.5 C40 25 34 31 24 39 Z" />
      <path d="M24 34 C17 28 12.5 23.5 12.5 18 C12.5 15 14.5 13.2 16.8 13.2" className="ei-thin" />
    </>
  ),
  balanca: (
    <>
      <path d="M24 7 V38 M16 40.5 H32 M19 38 H29" />
      <path d="M9 13 H39" />
      <circle cx="24" cy="7" r="1.8" />
      <path d="M9 13 L4.5 26 M9 13 L13.5 26 M39 13 L34.5 26 M39 13 L43.5 26" className="ei-thin" />
      <path d="M3.5 26 C4.5 30.5 13.5 30.5 14.5 26 Z M33.5 26 C34.5 30.5 43.5 30.5 44.5 26 Z" />
    </>
  ),
  sorriso: (
    <>
      <circle cx="24" cy="24" r="16" />
      <path d="M16.5 27.5 C19 32.5 29 32.5 31.5 27.5" />
      <circle cx="18.5" cy="20" r="1.4" className="ei-dot" />
      <path d="M27 20 C28.5 18.5 30.5 18.5 32 20" />
      <path d="M11 11 C9 8 11 5.5 13.5 7 M37 11 C39 8 37 5.5 34.5 7" className="ei-thin" />
    </>
  ),
  aliancas: (
    <>
      <circle cx="19" cy="28" r="10" />
      <circle cx="29" cy="28" r="10" />
      <circle cx="19" cy="28" r="7.5" className="ei-thin" />
      <circle cx="29" cy="28" r="7.5" className="ei-thin" />
      <path d="M29 18 L26 13.5 L29 9.5 L32 13.5 Z" />
      <path d="M26 13.5 H32" className="ei-thin" />
    </>
  ),
  envelope: (
    <>
      <rect x="6" y="12" width="36" height="25" />
      <path d="M6 12 L24 27 L42 12" />
      <path d="M6 37 L19 23 M42 37 L29 23" className="ei-thin" />
      <path d="M24 33 C21.5 31 20 29.8 20 28.3 C20 27.2 20.9 26.4 21.9 26.4 C22.8 26.4 23.5 27 24 27.8 C24.5 27 25.2 26.4 26.1 26.4 C27.1 26.4 28 27.2 28 28.3 C28 29.8 26.5 31 24 33 Z" className="ei-fill" />
    </>
  ),
  pin: (
    <>
      <path d="M24 42 C24 42 11 28.5 11 19 C11 11.5 17 6 24 6 C31 6 37 11.5 37 19 C37 28.5 24 42 24 42 Z" />
      <circle cx="24" cy="19" r="5" className="ei-thin" />
    </>
  ),
  relogio: (
    <>
      <circle cx="24" cy="25" r="15" />
      <circle cx="24" cy="25" r="12" className="ei-thin" />
      <path d="M24 16 V25 L30 29" />
      <path d="M21 6 H27 M24 6 V10" />
    </>
  ),
  vestido: (
    <>
      <path d="M19 6 V12 L15 20 L20 22 L10 42 H38 L28 22 L33 20 L29 12 V6" />
      <path d="M19 12 C21 14 27 14 29 12" className="ei-thin" />
      <path d="M20 22 C22.5 23.5 25.5 23.5 28 22" className="ei-thin" />
      <path d="M16 36 C22 38 26 38 32 36" className="ei-thin" />
    </>
  ),
}

export const ICON_NAMES = Object.keys(ICONS)

export function EngravedIcon({ name, className, size }: { name: string | null | undefined; className?: string; size?: number }) {
  const icon = (name && ICONS[name]) || ICONS.coracao
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={['ei', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      focusable="false"
    >
      {icon}
    </svg>
  )
}

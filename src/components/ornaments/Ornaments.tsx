/**
 * Ornamentos inspirados no Save the Date: filetes com arabesco, cantos barrocos,
 * brasão com urna e rosa-dos-ventos. Todos em traço fino (herdam `currentColor`).
 */
type SvgProps = { className?: string; title?: string }

const a11y = (title?: string) =>
  title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const, focusable: 'false' as const }

/** O divisor "— ∽ • ❦ • ∽ —" que aparece entre os blocos do Save the Date. */
export function Divider({ className, title }: SvgProps) {
  const half = (
    <g>
      <path d="M130 12 C134 7 141 6 146 9 C142 13 136 14 130 12 Z" />
      <path d="M131 13 C135 16 140 18 145 16" />
      <path d="M147 12 C153 12 155 7 160 7 C165 7 166 13 162 14 C159 15 158 11 160 10.5" />
      <circle cx="172" cy="12" r="1.4" className="orn-dot" />
      <path d="M179 12 H258" />
    </g>
  )
  return (
    <svg viewBox="0 0 260 24" className={['orn orn-divider', className].filter(Boolean).join(' ')} {...a11y(title)}>
      <path d="M130 2.5 C133.5 6 134.5 9 130 13.5 C125.5 9 126.5 6 130 2.5 Z" />
      <path d="M130 13.5 C132 15.5 132 18.5 130 21.5 C128 18.5 128 15.5 130 13.5 Z" />
      {half}
      <g transform="translate(260 0) scale(-1 1)">{half}</g>
    </svg>
  )
}

/** Filete simples com losango central (para espaços menores). */
export function Rule({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 160 12" className={['orn orn-rule', className].filter(Boolean).join(' ')} aria-hidden="true" focusable="false">
      <path d="M2 6 H70 M90 6 H158" />
      <path d="M80 1.5 L84.5 6 L80 10.5 L75.5 6 Z" />
      <circle cx="73" cy="6" r="1" className="orn-dot" />
      <circle cx="87" cy="6" r="1" className="orn-dot" />
    </svg>
  )
}

/** Canto barroco de moldura (superior esquerdo; gire/espelhe para os demais). */
export function FrameCorner({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 120 120" className={['orn orn-corner', className].filter(Boolean).join(' ')} aria-hidden="true" focusable="false">
      {/* filetes externos e internos */}
      <path d="M50 6 H118 M6 50 V118" />
      <path d="M58 13 H118 M13 58 V118" className="orn-thin" />
      <path d="M6 50 C6 26 26 6 50 6" />
      {/* volutas do canto */}
      <path d="M50 6 C39 6 30 13 30 24 C30 32 36 36 42 34 C47 32 47 26 43 24 C40 23 38 26 40 28" />
      <path d="M6 50 C6 39 13 30 24 30 C32 30 36 36 34 42 C32 47 26 47 24 43 C23 40 26 38 28 40" />
      {/* folha de acanto na diagonal */}
      <path d="M36 36 C44 40 50 46 54 54 C48 52 43 48 40 44 C42 50 43 56 41 62 C37 56 35 48 36 36 Z" />
      <path d="M36 36 C40 44 44 50 50 56" className="orn-thin" />
      {/* ramos ao longo dos filetes */}
      <path d="M62 6 C68 12 76 13 84 10" className="orn-thin" />
      <path d="M70 10 C71 6 75 4 78 5 C77 8 74 10 70 10 Z" />
      <path d="M80 11 C83 14 87 14 90 12 C87 10 83 10 80 11 Z" />
      <path d="M6 62 C12 68 13 76 10 84" className="orn-thin" />
      <path d="M10 70 C6 71 4 75 5 78 C8 77 10 74 10 70 Z" />
      <path d="M11 80 C14 83 14 87 12 90 C10 87 10 83 11 80 Z" />
      <circle cx="96" cy="6" r="1.5" className="orn-dot" />
      <circle cx="6" cy="96" r="1.5" className="orn-dot" />
    </svg>
  )
}

/** Moldura com os quatro cantos, posicionada sobre um elemento `position: relative`. */
export function FrameCorners() {
  return (
    <span className="frame-corners" aria-hidden="true">
      <FrameCorner className="fc fc-tl" />
      <FrameCorner className="fc fc-tr" />
      <FrameCorner className="fc fc-bl" />
      <FrameCorner className="fc fc-br" />
    </span>
  )
}

/** Brasão superior: urna com volutas e guirlandas (como o topo do dossel do Save the Date). */
export function Crest({ className, title }: SvgProps) {
  const side = (
    <g>
      <path d="M89 58 C74 61 62 54 60 46 C58 38 66 34 70 39 C73 43 68 46 66 43" />
      <path d="M60 46 C50 60 30 64 6 60" />
      <path d="M52 56 C44 52 40 46 42 40 C46 44 50 50 52 56 Z" />
      <path d="M36 61 C30 56 28 50 31 45 C34 50 36 55 36 61 Z" />
      <path d="M86 44 C74 56 54 57 40 48" className="orn-thin" />
      <circle cx="74" cy="53" r="1.6" className="orn-dot" />
      <circle cx="62" cy="55" r="1.3" className="orn-dot" />
      <circle cx="50" cy="53" r="1.1" className="orn-dot" />
      <path d="M90 42 C84 40 82 34 86 31 C89 30 90 33 88 34" />
    </g>
  )
  return (
    <svg viewBox="0 0 200 72" className={['orn orn-crest', className].filter(Boolean).join(' ')} {...a11y(title)}>
      <rect x="92" y="60" width="16" height="5" />
      <path d="M90 60 C82 52 82 41 92 36 L108 36 C118 41 118 52 110 60 Z" />
      <path d="M86 47 C95 50 105 50 114 47" className="orn-thin" />
      <path d="M94 40 V58 M100 40 V59 M106 40 V58" className="orn-thin" />
      <rect x="95" y="31" width="10" height="5" />
      <path d="M100 12 C106 18 107 25 103 31 L97 31 C93 25 94 18 100 12 Z" />
      <path d="M100 17 V28" className="orn-thin" />
      {side}
      <g transform="translate(200 0) scale(-1 1)">{side}</g>
    </svg>
  )
}

export function CompassRose({ className, title }: SvgProps) {
  const points = Array.from({ length: 8 }, (_, i) => {
    const long = i % 2 === 0
    const ang = (i * Math.PI) / 4 - Math.PI / 2
    const r = long ? 54 : 32
    const w = long ? 7 : 5
    const tip = [60 + Math.cos(ang) * r, 60 + Math.sin(ang) * r]
    const l = [60 + Math.cos(ang - Math.PI / 2) * w, 60 + Math.sin(ang - Math.PI / 2) * w]
    const rr = [60 + Math.cos(ang + Math.PI / 2) * w, 60 + Math.sin(ang + Math.PI / 2) * w]
    return { tip, l, rr, long }
  })
  const f = (n: number) => n.toFixed(1)
  return (
    <svg viewBox="0 0 120 120" className={['orn orn-compass', className].filter(Boolean).join(' ')} {...a11y(title)}>
      <circle cx="60" cy="60" r="46" />
      <circle cx="60" cy="60" r="42" className="orn-thin" />
      <circle cx="60" cy="60" r="22" className="orn-thin" />
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i * Math.PI) / 18
        const r1 = i % 3 === 0 ? 38 : 40
        return (
          <line key={i} x1={f(60 + Math.cos(a) * r1)} y1={f(60 + Math.sin(a) * r1)} x2={f(60 + Math.cos(a) * 42)} y2={f(60 + Math.sin(a) * 42)} className="orn-thin" />
        )
      })}
      {points.map((p, i) => (
        <g key={i}>
          <path d={`M60 60 L${f(p.l[0])} ${f(p.l[1])} L${f(p.tip[0])} ${f(p.tip[1])} Z`} className="orn-fill-soft" />
          <path d={`M60 60 L${f(p.rr[0])} ${f(p.rr[1])} L${f(p.tip[0])} ${f(p.tip[1])} Z`} />
        </g>
      ))}
      <circle cx="60" cy="60" r="3" className="orn-dot" />
      <text x="60" y="3.5" textAnchor="middle" className="orn-letter">
        N
      </text>
    </svg>
  )
}

export function Heart({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 24 22" className={['orn orn-heart', className].filter(Boolean).join(' ')} aria-hidden="true" focusable="false">
      <path d="M12 20 C6 15.5 2 12 2 7.5 C2 4.5 4.3 2.5 7 2.5 C9.2 2.5 10.8 3.8 12 5.8 C13.2 3.8 14.8 2.5 17 2.5 C19.7 2.5 22 4.5 22 7.5 C22 12 18 15.5 12 20 Z" />
    </svg>
  )
}

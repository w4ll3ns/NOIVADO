/**
 * Fachada da Casa de Zaquia em estilo gravura arquitetônica (traço sépia fino,
 * aguada creme muito leve, hachuras nas sombras e azulejos discretos — São Luís).
 *
 * Elevação frontal de um sobrado colonial de dois pavimentos com cinco vãos,
 * sacadas de ferro, platibanda balaustrada e frontão central com monograma.
 * A porta principal fica no vão central; suas folhas podem ser desenhadas no próprio
 * SVG (`withDoor`) ou sobrepostas em HTML para a animação 3D da abertura.
 */
import type { ReactNode } from 'react'

export const FACADE_W = 1000
export const FACADE_H = 820

/** Geometria da porta principal (coordenadas do viewBox). */
export const DOOR = { x: 452, y: 551, w: 96, h: 201, cx: 500, springY: 548, r: 48 } as const

const BAYS = [160, 330, 500, 670, 840]
const PILASTERS = [75, 245, 415, 585, 755, 925]
const range = (from: number, to: number, step: number) => {
  const out: number[] = []
  for (let v = from; v <= to + 0.001; v += step) out.push(Math.round(v * 100) / 100)
  return out
}

type Props = {
  /** Prefixo único para ids de padrões (várias fachadas na mesma página). */
  idPrefix: string
  withDoor?: boolean
  monogram?: string
  className?: string
  title?: string
}

export function Facade({ idPrefix, withDoor = true, monogram = 'M&C', className, title }: Props) {
  const p = (name: string) => `${idPrefix}-${name}`
  const url = (name: string) => `url(#${p(name)})`

  return (
    <svg
      className={['cz', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${FACADE_W} ${FACADE_H}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <pattern id={p('hatch')} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" className="cz-hatch-line" />
        </pattern>
        <pattern id={p('hatch-dense')} width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
          <line x1="0" y1="0" x2="0" y2="3" className="cz-hatch-line" />
        </pattern>
        <pattern id={p('azulejo')} width="26" height="26" patternUnits="userSpaceOnUse">
          <rect width="26" height="26" className="cz-tile-grid" />
          <path d="M13 3 L23 13 L13 23 L3 13 Z" className="cz-tile" />
          <path d="M13 8 C15 11 15 15 13 18 C11 15 11 11 13 8 Z M8 13 C11 11 15 11 18 13 C15 15 11 15 8 13 Z" className="cz-tile" />
          <circle cx="0" cy="0" r="2.2" className="cz-tile" />
          <circle cx="26" cy="0" r="2.2" className="cz-tile" />
          <circle cx="0" cy="26" r="2.2" className="cz-tile" />
          <circle cx="26" cy="26" r="2.2" className="cz-tile" />
        </pattern>
        <radialGradient id={p('interior')} cx="50%" cy="42%" r="70%">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.45" stopColor="#fbe7c4" />
          <stop offset="1" stopColor="#e2c298" />
        </radialGradient>
        <radialGradient id={p('lamp')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff4d8" stopOpacity="1" />
          <stop offset="0.5" stopColor="#f8e0b0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f8e0b0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={p('spill')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbe3b7" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fbe3b7" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ---------------- Plantas ao fundo (lado esquerdo) ---------------- */}
      <LeftPlant />

      {/* ---------------- Aguada das paredes + azulejos ---------------- */}
      <rect x="60" y="175" width="880" height="565" className="cz-wall" />
      <rect x="60" y="186" width="880" height="232" fill={url('azulejo')} className="cz-azulejo" />
      <rect x="60" y="452" width="880" height="288" fill={url('azulejo')} className="cz-azulejo" />

      {/* ---------------- Platibanda e frontão ---------------- */}
      <Parapet hatch={url('hatch')} />
      <Pediment monogram={monogram} hatch={url('hatch')} />

      {/* ---------------- Cornija principal ---------------- */}
      <g>
        <rect x="46" y="140" width="908" height="10" className="cz-fill-stone cz-l1" />
        <line x1="52" y1="155" x2="948" y2="155" className="cz-l2" />
        {range(60, 936, 14).map((x) => (
          <rect key={x} x={x} y="158" width="7" height="8" className="cz-l3 cz-fill-stone" />
        ))}
        <line x1="56" y1="168" x2="944" y2="168" className="cz-l2" />
        <line x1="60" y1="175" x2="940" y2="175" className="cz-l1" />
        <rect x="60" y="175" width="880" height="7" fill={url('hatch')} />
      </g>

      {/* ---------------- Pavimento superior ---------------- */}
      {PILASTERS.map((x) => (
        <UpperPilaster key={x} x={x} corner={x === 75 || x === 925} />
      ))}
      {BAYS.map((c) => (
        <UpperWindow key={c} c={c} central={c === 500} hatch={url('hatch')} />
      ))}

      {/* ---------------- Cornija entre pavimentos ---------------- */}
      <g>
        <rect x="52" y="420" width="896" height="9" className="cz-fill-stone cz-l1" />
        <line x1="58" y1="434" x2="942" y2="434" className="cz-l2" />
        <line x1="60" y1="441" x2="940" y2="441" className="cz-l3" />
        <line x1="60" y1="450" x2="940" y2="450" className="cz-l1" />
        <rect x="60" y="450" width="880" height="6" fill={url('hatch')} />
      </g>

      {/* ---------------- Térreo ---------------- */}
      {PILASTERS.map((x) => (
        <GroundPilaster key={x} x={x} />
      ))}
      {BAYS.filter((c) => c !== 500).map((c) => (
        <GroundWindow key={c} c={c} hatch={url('hatch')} />
      ))}

      {/* Porta principal */}
      <MainDoorFrame p={p} url={url} withDoor={withDoor} />

      {/* Lampiões */}
      <Lantern x={415} y={590} glow={url('lamp')} />
      <Lantern x={585} y={590} glow={url('lamp')} />

      {/* ---------------- Embasamento ---------------- */}
      <Plinth />

      {/* ---------------- Calçada ---------------- */}
      <Sidewalk spill={url('spill')} />

      {/* ---------------- Palmeira (lado direito) ---------------- */}
      <Palm />
    </svg>
  )
}

/* =================================================================== */

function Parapet({ hatch }: { hatch: string }) {
  const segments: [number, number][] = [
    [75, 245],
    [245, 415],
    [585, 755],
    [755, 925],
  ]
  return (
    <g>
      {segments.map(([a, b]) => (
        <g key={a}>
          <rect x={a + 20} y="88" width={b - a - 40} height="7" className="cz-fill-stone cz-l2" />
          <rect x={a + 20} y="130" width={b - a - 40} height="10" className="cz-fill-stone cz-l2" />
          {range(a + 32, b - 32, 17).map((x) => (
            <path
              key={x}
              transform={`translate(${x} 0)`}
              d="M-2.4 95 C-2.4 98 -1.6 99.5 -1.6 102 C-1.6 107 -5.4 112 -5.4 119 C-5.4 124 -3.2 127 -2.2 130 L2.2 130 C3.2 127 5.4 124 5.4 119 C5.4 112 1.6 107 1.6 102 C1.6 99.5 2.4 98 2.4 95 Z"
              className="cz-fill-stone cz-l3"
            />
          ))}
          <rect x={a + 20} y="96" width={b - a - 40} height="3" fill={hatch} opacity="0.7" />
        </g>
      ))}
      {PILASTERS.filter((x) => x !== 415 && x !== 585).map((x) => (
        <g key={x}>
          <rect x={x - 20} y="84" width="40" height="56" className="cz-fill-stone cz-l1" />
          <rect x={x - 24} y="78" width="48" height="7" className="cz-fill-stone cz-l2" />
          <rect x={x - 14} y="93" width="28" height="38" className="cz-l3" />
          <Finial x={x} base={78} scale={0.8} />
        </g>
      ))}
    </g>
  )
}

function Finial({ x, base, scale = 1 }: { x: number; base: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${base}) scale(${scale})`}>
      <rect x="-9" y="-5" width="18" height="5" className="cz-fill-stone cz-l2" />
      <path
        d="M-8 -5 C-15 -12 -14 -24 -5 -28 L5 -28 C14 -24 15 -12 8 -5 Z"
        className="cz-fill-stone cz-l2"
      />
      <path d="M-11 -14 C-4 -12 4 -12 11 -14" className="cz-l3" />
      <rect x="-4" y="-33" width="8" height="5" className="cz-fill-stone cz-l3" />
      <path d="M0 -48 C5 -43 6 -38 3 -33 L-3 -33 C-6 -38 -5 -43 0 -48 Z" className="cz-fill-stone cz-l2" />
    </g>
  )
}

function Pediment({ monogram, hatch }: { monogram: string; hatch: string }) {
  return (
    <g>
      <path
        d="M405 140 V104 C405 90 420 82 432 76 C450 66 462 44 500 40 C538 44 550 66 568 76 C580 82 595 90 595 104 V140 Z"
        className="cz-fill-stone cz-l1"
      />
      <path
        d="M414 140 V106 C414 94 426 88 437 82 C455 72 466 52 500 48 C534 52 545 72 563 82 C574 88 586 94 586 106 V140"
        className="cz-l3"
      />
      {/* volutas laterais */}
      <path d="M405 118 C394 118 388 112 390 105 C392 99 400 99 401 104 C402 108 397 109 396 106" className="cz-l2" />
      <path d="M595 118 C606 118 612 112 610 105 C608 99 600 99 599 104 C598 108 603 109 604 106" className="cz-l2" />
      {/* cartela com monograma */}
      <ellipse cx="500" cy="100" rx="38" ry="27" className="cz-fill-ivory cz-l2" />
      <ellipse cx="500" cy="100" rx="32" ry="22" className="cz-l3" />
      <path d="M462 100 C454 94 452 86 458 82 C462 80 465 84 462 87" className="cz-l3" />
      <path d="M538 100 C546 94 548 86 542 82 C538 80 535 84 538 87" className="cz-l3" />
      <path d="M470 124 C480 132 520 132 530 124" className="cz-l3" />
      <text x="500" y="110" textAnchor="middle" className="cz-monogram">
        {monogram}
      </text>
      <rect x="405" y="134" width="190" height="6" fill={hatch} opacity="0.6" />
      <Finial x={500} base={40} scale={1} />
    </g>
  )
}

function UpperPilaster({ x, corner }: { x: number; corner: boolean }) {
  const w = corner ? 18 : 16
  return (
    <g>
      <rect x={x - w} y="175" width={w * 2} height="245" className="cz-fill-stone cz-l1" />
      <rect x={x - w - 4} y="182" width={(w + 4) * 2} height="9" className="cz-fill-stone cz-l2" />
      <line x1={x - w} y1="196" x2={x + w} y2="196" className="cz-l3" />
      <line x1={x - 7} y1="202" x2={x - 7} y2="402" className="cz-l3" />
      <line x1={x + 7} y1="202" x2={x + 7} y2="402" className="cz-l3" />
      <rect x={x - w - 3} y="406" width={(w + 3) * 2} height="14" className="cz-fill-stone cz-l2" />
      <rect x={x + w - 5} y="197" width="5" height="209" className="cz-shade" />
    </g>
  )
}

function UpperWindow({ c, central, hatch }: { c: number; central: boolean; hatch: string }) {
  const railBars = range(c - 52, c + 52, 8)
  return (
    <g>
      {/* verga / frontão da janela */}
      {central ? (
        <g>
          <path d={`M${c - 58} 214 L${c} 190 L${c + 58} 214 Z`} className="cz-fill-stone cz-l2" />
          <path d={`M${c - 46} 210 L${c} 197 L${c + 46} 210`} className="cz-l3" />
          <path
            d={`M${c} 212 C${c - 7} 206 ${c - 6} 200 ${c} 199 C${c + 6} 200 ${c + 7} 206 ${c} 212 Z`}
            className="cz-l3"
          />
        </g>
      ) : (
        <g>
          <rect x={c - 55} y="206" width="110" height="7" className="cz-fill-stone cz-l2" />
          <line x1={c - 50} y1="216" x2={c + 50} y2="216" className="cz-l3" />
        </g>
      )}
      {/* moldura */}
      <path d={`M${c - 48} 405 V244 Q${c} 214 ${c + 48} 244 V405`} className="cz-fill-stone cz-l1" />
      {/* vão */}
      <path d={`M${c - 40} 405 V248 Q${c} 224 ${c + 40} 248 V405 Z`} className="cz-glass cz-l2" />
      <path d={`M${c - 40} 405 V248 Q${c} 224 ${c + 40} 248 V405 Z`} fill={hatch} opacity="0.55" />
      {/* aduela / chave */}
      <path d={`M${c - 7} 238 L${c - 9} 222 L${c + 9} 222 L${c + 7} 238 Z`} className="cz-fill-stone cz-l2" />
      {/* caixilhos */}
      <line x1={c} y1="238" x2={c} y2="405" className="cz-l2" />
      <path d={`M${c - 40} 266 H${c + 40}`} className="cz-l2" />
      {[294, 322].map((y) => (
        <line key={y} x1={c - 40} y1={y} x2={c + 40} y2={y} className="cz-l3" />
      ))}
      <line x1={c - 20} y1="266" x2={c - 20} y2="356" className="cz-l3" />
      <line x1={c + 20} y1="266" x2={c + 20} y2="356" className="cz-l3" />
      {[-30, -12, 12, 30].map((dx) => (
        <line key={dx} x1={c} y1="266" x2={c + dx} y2={248 - (1 - Math.abs(dx) / 40) * 14} className="cz-l3" />
      ))}
      {/* sacada: guarda-corpo de ferro */}
      <rect x={c - 56} y="356" width="112" height="4" className="cz-fill-iron cz-l2" />
      <rect x={c - 56} y="398" width="112" height="4" className="cz-fill-iron cz-l2" />
      {railBars.map((x) => (
        <line key={x} x1={x} y1="360" x2={x} y2="398" className="cz-iron" />
      ))}
      {railBars.slice(0, -1).map((x) => (
        <circle key={x} cx={x + 4} cy="379" r="3" className="cz-iron-ring" />
      ))}
      <line x1={c - 56} y1="372" x2={c + 56} y2="372" className="cz-l3" />
      <line x1={c - 56} y1="386" x2={c + 56} y2="386" className="cz-l3" />
      {/* laje e mísulas */}
      <rect x={c - 62} y="402" width="124" height="8" className="cz-fill-stone cz-l1" />
      <line x1={c - 58} y1="413" x2={c + 58} y2="413" className="cz-l3" />
      <path d={`M${c - 50} 410 C${c - 50} 419 ${c - 42} 418 ${c - 42} 427`} className="cz-l2" />
      <path d={`M${c + 50} 410 C${c + 50} 419 ${c + 42} 418 ${c + 42} 427`} className="cz-l2" />
    </g>
  )
}

function GroundPilaster({ x }: { x: number }) {
  return (
    <g>
      <rect x={x - 17} y="450" width="34" height="290" className="cz-fill-stone cz-l1" />
      {range(472, 730, 22).map((y) => (
        <line key={y} x1={x - 17} y1={y} x2={x + 17} y2={y} className="cz-l3" />
      ))}
      <rect x={x - 20} y="450" width="40" height="8" className="cz-fill-stone cz-l2" />
      <rect x={x + 12} y="458" width="5" height="282" className="cz-shade" />
    </g>
  )
}

function GroundWindow({ c, hatch }: { c: number; hatch: string }) {
  const slats = range(540, 682, 6)
  return (
    <g>
      <path d={`M${c - 46} 692 V528 A46 46 0 0 1 ${c + 46} 528 V692`} className="cz-fill-stone cz-l1" />
      <path d={`M${c - 38} 692 V528 A38 38 0 0 1 ${c + 38} 528 V692 Z`} className="cz-glass cz-l2" />
      {/* bandeira */}
      <path d={`M${c - 38} 528 A38 38 0 0 1 ${c + 38} 528 Z`} fill={hatch} opacity="0.5" />
      {[30, 60, 90, 120, 150].map((deg) => {
        const rad = (deg * Math.PI) / 180
        return (
          <line
            key={deg}
            x1={c + Math.cos(rad) * 10}
            y1={528 - Math.sin(rad) * 10}
            x2={c + Math.cos(rad) * 38}
            y2={528 - Math.sin(rad) * 38}
            className="cz-l3"
          />
        )
      })}
      <path d={`M${c - 10} 528 A10 10 0 0 1 ${c + 10} 528`} className="cz-l3" />
      <rect x={c - 38} y="526" width="76" height="5" className="cz-fill-stone cz-l2" />
      {/* chave do arco */}
      <path d={`M${c - 8} 480 L${c + 8} 480 L${c + 6} 495 L${c - 6} 495 Z`} className="cz-fill-stone cz-l2" />
      {/* venezianas */}
      <rect x={c - 36} y="533" width="34" height="156" className="cz-fill-wood cz-l2" />
      <rect x={c + 2} y="533" width="34" height="156" className="cz-fill-wood cz-l2" />
      {slats.map((y) => (
        <g key={y}>
          <line x1={c - 33} y1={y} x2={c - 5} y2={y} className="cz-l3" />
          <line x1={c + 5} y1={y} x2={c + 33} y2={y} className="cz-l3" />
        </g>
      ))}
      <rect x={c - 36} y="533" width="72" height="6" fill={hatch} opacity="0.6" />
      {/* peitoril */}
      <rect x={c - 52} y="690" width="104" height="8" className="cz-fill-stone cz-l1" />
      <line x1={c - 46} y1="702" x2={c + 46} y2="702" className="cz-l3" />
    </g>
  )
}

function MainDoorFrame({
  p,
  url,
  withDoor,
}: {
  p: (n: string) => string
  url: (n: string) => string
  withDoor: boolean
}) {
  const { x, y, w, h, cx, springY, r } = DOOR
  const R = 64
  return (
    <g>
      {/* arquivolta */}
      <path d={`M${cx - R} 752 V${springY} A${R} ${R} 0 0 1 ${cx + R} ${springY} V752`} className="cz-fill-stone cz-l1" />
      {range(15, 165, 15).map((deg) => {
        const rad = (deg * Math.PI) / 180
        return (
          <line
            key={deg}
            x1={cx + Math.cos(rad) * r}
            y1={springY - Math.sin(rad) * r}
            x2={cx + Math.cos(rad) * R}
            y2={springY - Math.sin(rad) * R}
            className="cz-l3"
          />
        )
      })}
      <path d={`M${cx - R + 6} 752 V${springY}`} className="cz-l3" />
      <path d={`M${cx + R - 6} 752 V${springY}`} className="cz-l3" />
      {/* chave ornamentada */}
      <path d={`M${cx - 10} 478 L${cx + 10} 478 L${cx + 7} 504 L${cx - 7} 504 Z`} className="cz-fill-stone cz-l1" />
      <path d={`M${cx} 484 C${cx + 5} 489 ${cx + 4} 495 ${cx} 499 C${cx - 4} 495 ${cx - 5} 489 ${cx} 484 Z`} className="cz-l3" />

      {/* bandeira (vidro) */}
      <path d={`M${cx - r} ${springY} A${r} ${r} 0 0 1 ${cx + r} ${springY} Z`} className="cz-glass cz-l2" />
      <path
        d={`M${cx - r} ${springY} A${r} ${r} 0 0 1 ${cx + r} ${springY} Z`}
        className="cz-fanlight-glow"
        fill={url('interior')}
      />
      {range(22.5, 157.5, 22.5).map((deg) => {
        const rad = (deg * Math.PI) / 180
        return (
          <line
            key={deg}
            x1={cx + Math.cos(rad) * 14}
            y1={springY - Math.sin(rad) * 14}
            x2={cx + Math.cos(rad) * r}
            y2={springY - Math.sin(rad) * r}
            className="cz-l3"
          />
        )
      })}
      <path d={`M${cx - 14} ${springY} A14 14 0 0 1 ${cx + 14} ${springY}`} className="cz-l3" />
      <rect x={x} y={springY - 2} width={w} height="5" className="cz-fill-stone cz-l2" />

      {/* interior iluminado (revelado quando a porta abre) */}
      <g className="cz-interior">
        <rect x={x} y={y} width={w} height={h} fill={url('interior')} />
        <g className="cz-interior-lines">
          <path d={`M${x} ${y + h} L${cx - 20} ${y + 118} M${x + w} ${y + h} L${cx + 20} ${y + 118}`} />
          <path d={`M${cx - 20} ${y + 118} H${cx + 20} V${y + 62} A20 20 0 0 0 ${cx - 20} ${y + 62} Z`} />
          {range(y + 135, y + h, 22).map((yy, i) => {
            const t = (yy - (y + 118)) / (h - 118)
            return <line key={yy} x1={cx - 20 - t * 28} y1={yy} x2={cx + 20 + t * 28} y2={yy} opacity={0.4 + i * 0.1} />
          })}
          <line x1={cx} y1={y} x2={cx} y2={y + 26} />
          <path d={`M${cx - 16} ${y + 34} C${cx - 12} ${y + 42} ${cx + 12} ${y + 42} ${cx + 16} ${y + 34}`} />
          <path d={`M${cx - 16} ${y + 34} V${y + 29} M${cx} ${y + 38} V${y + 29} M${cx + 16} ${y + 34} V${y + 29}`} />
          <path d={`M${cx - 10} ${y + 29} H${cx + 10}`} />
        </g>
      </g>
      <rect id={p('door-opening')} x={x} y={y} width={w} height={h} className="cz-door-frame" />

      {withDoor ? (
        <g>
          <g transform={`translate(${x} ${y})`}>
            <DoorLeafArt side="left" hatch={url('hatch')} />
          </g>
          <g transform={`translate(${x + w / 2} ${y})`}>
            <DoorLeafArt side="right" hatch={url('hatch')} />
          </g>
        </g>
      ) : null}

      {/* degraus */}
      <rect x="418" y="752" width="164" height="12" className="cz-fill-stone cz-l1" />
      <rect x="404" y="764" width="192" height="16" className="cz-fill-stone cz-l1" />
      <line x1="422" y1="756" x2="578" y2="756" className="cz-l3" />
      <line x1="408" y1="768" x2="592" y2="768" className="cz-l3" />
    </g>
  )
}

/** Folha da porta em coordenadas locais (48 × 201). */
export function DoorLeafArt({ side, hatch }: { side: 'left' | 'right'; hatch: string }): ReactNode {
  const W = 48
  const H = 201
  const knobX = side === 'left' ? 41 : 7
  const panels: [number, number][] = [
    [12, 56],
    [66, 140],
    [150, 190],
  ]
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} className="cz-fill-wood cz-l1" />
      <rect x="4" y="4" width={W - 8} height={H - 8} className="cz-l3" />
      {panels.map(([top, bottom]) => {
        const x1 = 9
        const x2 = W - 9
        const i = 5
        return (
          <g key={top}>
            <rect x={x1} y={top} width={x2 - x1} height={bottom - top} className="cz-l2" />
            <rect x={x1 + i} y={top + i} width={x2 - x1 - 2 * i} height={bottom - top - 2 * i} className="cz-fill-wood-light cz-l3" />
            <path
              d={`M${x1} ${bottom} L${x1 + i} ${bottom - i} H${x2 - i} L${x2} ${bottom} Z`}
              fill={hatch}
              opacity="0.9"
            />
            <path
              d={`M${x1} ${top} L${x1 + i} ${top + i} M${x2} ${top} L${x2 - i} ${top + i} M${x1} ${bottom} L${x1 + i} ${bottom - i} M${x2} ${bottom} L${x2 - i} ${bottom - i}`}
              className="cz-l3"
            />
          </g>
        )
      })}
      <circle cx={knobX} cy="104" r="4.2" className="cz-l2" />
      <circle cx={knobX} cy="99" r="1.6" className="cz-fill-iron cz-l3" />
      <rect x={side === 'left' ? W - 2 : 0} y="0" width="2" height={H} fill={hatch} />
    </g>
  )
}

function Lantern({ x, y, glow }: { x: number; y: number; glow: string }) {
  return (
    <g>
      <circle cx={x} cy={y + 20} r="38" fill={glow} className="cz-lamp-glow" />
      <path d={`M${x} ${y - 14} C${x + 10} ${y - 14} ${x + 10} ${y - 4} ${x + 3} ${y - 4} M${x} ${y - 14} V${y}`} className="cz-l2" />
      <path d={`M${x - 9} ${y + 4} L${x + 9} ${y + 4} L${x + 6} ${y} L${x - 6} ${y} Z`} className="cz-fill-iron cz-l2" />
      <path d={`M${x - 8} ${y + 4} L${x - 6} ${y + 34} L${x + 6} ${y + 34} L${x + 8} ${y + 4} Z`} className="cz-lamp-glass cz-l2" />
      <line x1={x} y1={y + 4} x2={x} y2={y + 34} className="cz-l3" />
      <path d={`M${x - 7} ${y + 34} L${x + 7} ${y + 34} L${x + 3} ${y + 40} L${x - 3} ${y + 40} Z`} className="cz-fill-iron cz-l2" />
      <path d={`M${x} ${y - 6} V${y}`} className="cz-l3" />
    </g>
  )
}

function Plinth() {
  const rows: [number, number, number][] = [
    [740, 760, 0],
    [760, 780, 22],
  ]
  return (
    <g>
      <rect x="60" y="740" width="344" height="40" className="cz-fill-plinth cz-l1" />
      <rect x="596" y="740" width="344" height="40" className="cz-fill-plinth cz-l1" />
      <line x1="60" y1="745" x2="404" y2="745" className="cz-l3" />
      <line x1="596" y1="745" x2="940" y2="745" className="cz-l3" />
      {rows.map(([y1, y2, off]) => (
        <g key={y1}>
          <line x1="60" y1={y2} x2="404" y2={y2} className="cz-l3" />
          <line x1="596" y1={y2} x2="940" y2={y2} className="cz-l3" />
          {range(60 + off + 44, 400, 44).map((xx) => (
            <line key={xx} x1={xx} y1={y1 + 5} x2={xx} y2={y2} className="cz-l3" />
          ))}
          {range(596 + off + 44, 936, 44).map((xx) => (
            <line key={xx} x1={xx} y1={y1 + 5} x2={xx} y2={y2} className="cz-l3" />
          ))}
        </g>
      ))}
    </g>
  )
}

function Sidewalk({ spill }: { spill: string }) {
  // Pedras irregulares (pseudoaleatório determinístico para o SSR bater com o cliente).
  const rows = [791, 803, 815]
  let seed = 7
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  return (
    <g>
      <path d="M404 780 L452 752 H548 L596 780 L640 820 H360 Z" fill={spill} className="cz-spill" />
      <line x1="0" y1="780" x2="1000" y2="780" className="cz-l1" />
      <line x1="0" y1="785" x2="1000" y2="785" className="cz-l3" />
      {rows.map((y, i) => {
        const stones: [number, number][] = []
        let x = i % 2 ? -6 : 4
        while (x < 1000) {
          const w = 12 + rnd() * 14
          stones.push([x, w])
          x += w + 3 + rnd() * 3
        }
        return (
          <g key={y} opacity={0.62 - i * 0.18}>
            {stones.map(([sx, w]) => (
              <rect key={sx} x={sx.toFixed(1)} y={y - 4} width={w.toFixed(1)} height={7 + (rnd() > 0.5 ? 1 : 0)} rx="3.5" className="cz-l3" />
            ))}
          </g>
        )
      })}
    </g>
  )
}

function Palm() {
  const fronds = [
    'M956 452 C926 424 884 424 856 452',
    'M956 452 C936 408 906 390 874 390',
    'M956 452 C950 404 934 380 916 368',
    'M956 452 C964 406 984 384 1010 378',
    'M956 452 C990 430 1024 436 1046 460',
    'M956 452 C918 452 890 470 872 506',
    'M956 452 C994 462 1012 490 1016 526',
    'M956 452 C940 470 930 496 928 528',
    'M956 452 C972 470 982 494 984 522',
  ]
  return (
    <g className="cz-plant">
      <path d="M968 780 C968 700 964 590 954 456" className="cz-l1" />
      <path d="M979 780 C978 700 972 590 962 456" className="cz-l1" />
      {range(470, 772, 13).map((y) => {
        const t = (y - 456) / 324
        const xl = 954 + t * 14
        return <path key={y} d={`M${xl.toFixed(1)} ${y} q${(5 + t).toFixed(1)} 3.5 ${(10 + t * 2).toFixed(1)} 0`} className="cz-l3" />
      })}
      {fronds.map((d, i) => (
        <g key={i}>
          <path d={d} className="cz-l2" />
          <Leaflets d={d} size={19} step={0.055} droop={1.1} />
        </g>
      ))}
      <circle cx="950" cy="462" r="4" className="cz-fill-plinth cz-l3" />
      <circle cx="959" cy="464" r="4" className="cz-fill-plinth cz-l3" />
      {/* folhagem baixa */}
      <path d="M940 780 C930 760 918 752 902 752 M946 780 C944 758 950 742 962 734 M1000 780 C992 762 998 748 1010 742" className="cz-l2" />
      <path d="M902 752 C914 756 926 764 940 780 M962 734 C958 752 952 766 946 780" className="cz-l3" />
    </g>
  )
}

/** Folíolos desenhados ao longo de uma curva de Bézier cúbica simples. */
function Leaflets({ d, size: base = 16, step = 0.08, droop = 0.8 }: { d: string; size?: number; step?: number; droop?: number }) {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  if (nums.length < 8) return null
  const [x0, y0, x1, y1, x2, y2, x3, y3] = nums
  const pt = (t: number) => {
    const mt = 1 - t
    return [
      mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
      mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3,
    ]
  }
  const lines: string[] = []
  for (let t = 0.12; t <= 0.97; t += step) {
    const [px, py] = pt(t)
    const [qx, qy] = pt(Math.min(1, t + 0.01))
    const dx = qx - px
    const dy = qy - py
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const size = base * (1 - t * 0.6)
    const bx = (dx / len) * size * droop
    const by = (dy / len) * size * droop + size * 0.25
    lines.push(
      `M${px.toFixed(1)} ${py.toFixed(1)} l${(nx * size + bx).toFixed(1)} ${(ny * size + by).toFixed(1)}`,
      `M${px.toFixed(1)} ${py.toFixed(1)} l${(-nx * size + bx).toFixed(1)} ${(-ny * size + by).toFixed(1)}`,
    )
  }
  return <path d={lines.join(' ')} className="cz-l3" />
}

function LeftPlant() {
  const fronds = [
    'M34 742 C22 716 4 706 -14 710',
    'M34 742 C26 708 14 690 -2 680',
    'M34 742 C32 704 38 682 50 666',
    'M34 742 C44 712 62 700 80 702',
    'M34 742 C48 726 66 724 82 732',
  ]
  return (
    <g className="cz-plant">
      {fronds.map((d, i) => (
        <g key={i}>
          <path d={d} className="cz-l2" />
          <Leaflets d={d} size={9} step={0.07} droop={0.5} />
        </g>
      ))}
      {/* vaso em forma de urna */}
      <path d="M12 742 H56 C56 752 50 758 44 762 L46 772 H22 L24 762 C18 758 12 752 12 742 Z" className="cz-fill-plinth cz-l2" />
      <rect x="18" y="772" width="32" height="8" className="cz-fill-plinth cz-l2" />
      <path d="M14 748 H54" className="cz-l3" />
    </g>
  )
}

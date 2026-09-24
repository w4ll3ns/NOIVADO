/**
 * Ornamentos do Save the Date — recortados da própria arte (scripts/art/moldura.py):
 * filetes com arabesco e losango, o canto de voluta, o topo do dossel (brasão) e a moldura
 * inteira. A rosa-dos-ventos e o coração seguem em traço vetorial (herdam `currentColor`).
 */
import type { CSSProperties } from 'react'

type SvgProps = { className?: string; title?: string }

const a11y = (title?: string) =>
  title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const, focusable: 'false' as const }

type PecaProps = { nome: string; w: number; h: number; className: string; title?: string; style?: CSSProperties; eager?: boolean }

/** Peça recortada do Save the Date (AVIF, com WebP para navegadores antigos). */
function Peca({ nome, w, h, className, title, style, eager }: PecaProps) {
  return (
    <picture className={`orn-peca ${className}`} style={style} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <source type="image/avif" srcSet={`/brand/${nome}.avif`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/brand/${nome}.webp`} width={w} height={h} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} />
    </picture>
  )
}

/** O filete com arabesco que aparece entre os blocos do Save the Date. */
export function Divider({ className, title }: SvgProps) {
  return <Peca nome="filete-arabesco" w={1040} h={104} className={['orn-divider', className].filter(Boolean).join(' ')} title={title} eager />
}

/** O filete com losango (sob a data, no Save the Date). */
export function Rule({ className }: SvgProps) {
  return <Peca nome="filete-losango" w={752} h={84} className={['orn-rule', className].filter(Boolean).join(' ')} eager />
}

/** Canto de voluta do Save the Date (a peça é o canto inferior esquerdo; o CSS espelha os demais). */
export function FrameCorner({ className }: SvgProps) {
  return <Peca nome="canto" w={708} h={534} className={['orn-corner', className].filter(Boolean).join(' ')} />
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

/** Brasão: o topo do dossel do Save the Date (urna com folhagem sobre a cúpula). */
export function Crest({ className, title }: SvgProps) {
  return <Peca nome="coroa" w={536} h={464} className={['orn-crest', className].filter(Boolean).join(' ')} title={title} eager />
}

/** A moldura inteira do Save the Date: dossel com querubins e cortinas, volutas e arremate. */
export function SaveTheDateFrame({ className }: { className?: string }) {
  return <Peca nome="moldura" w={1764} h={2560} className={['orn-moldura', className].filter(Boolean).join(' ')} eager />
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

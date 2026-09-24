/**
 * O casarão da Casa de Zaquia — o desenho original do Save the Date (public/brand/casarao.*,
 * gerado por scripts/art/casarao.py) com traço sépia sobre fundo transparente.
 *
 * Por baixo do traço, uma camada opcional acende as janelas e o portão com luz quente;
 * os recortes seguem exatamente os vidros do desenho (src/components/casarao/casarao-data.ts).
 */
import { useId, type CSSProperties, type ReactNode } from 'react'
import { CASARAO } from './casarao-data'

export const CASARAO_W = CASARAO.width
export const CASARAO_H = CASARAO.height
const PORTA = CASARAO.regions.find((r) => r.id === 'porta')!

/** Portão principal, em frações da arte (para a câmera da abertura mirar nele). */
export const CASARAO_PORTA = {
  x: PORTA.cx / CASARAO_W,
  y: PORTA.cy / CASARAO_H,
  w: PORTA.box[2] / CASARAO_W,
  h: PORTA.box[3] / CASARAO_H,
}

type Props = {
  /** Traço reforçado, para tamanhos pequenos (rodapé, cartões de QR). */
  forte?: boolean
  /** Luz nas janelas: 'acesas' (fixas), 'acender' (acendem uma a uma ao carregar) ou 'apagadas'. */
  luzes?: 'acesas' | 'acender' | 'apagadas'
  /** Tamanho exibido, para o navegador escolher o arquivo (atributo sizes). */
  sizes?: string
  /** Texto alternativo; vazio quando o desenho é decorativo. */
  alt?: string
  /** Carregamento prioritário (abertura e topo da página). */
  priority?: boolean
  className?: string
  /** Camadas extras por cima do desenho (ex.: o canvas da animação de desenho). */
  children?: ReactNode
}

export function Casarao({ forte, luzes = 'apagadas', sizes, alt = '', priority, className, children }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const base = forte ? '/brand/casarao-forte-640' : '/brand/casarao'
  const srcSet = (ext: string) => (forte ? `${base}.${ext} 640w` : `/brand/casarao-640.${ext} 640w, ${base}.${ext} ${CASARAO_W}w`)
  const size = sizes ?? (forte ? '260px' : '(max-width: 640px) 92vw, 560px')
  return (
    <div
      className={['casarao', luzes !== 'apagadas' && `casarao--${luzes}`, className].filter(Boolean).join(' ')}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
    >
      {luzes !== 'apagadas' ? <Luzes uid={uid} /> : null}
      <picture>
        <source type="image/avif" srcSet={srcSet('avif')} sizes={size} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="casarao__traco"
          src={`${base}.webp`}
          srcSet={srcSet('webp')}
          sizes={size}
          width={CASARAO_W}
          height={CASARAO_H}
          alt=""
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          draggable={false}
        />
      </picture>
      {children}
    </div>
  )
}

function Luzes({ uid }: { uid: string }) {
  const g = `${uid}-luz`
  return (
    <svg className="casarao__luzes" viewBox={`0 0 ${CASARAO_W} ${CASARAO_H}`} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={g} cx="50%" cy="58%" r="68%">
          <stop offset="0" style={{ stopColor: 'var(--luz-centro)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--luz-meio)' }} />
          <stop offset="1" style={{ stopColor: 'var(--luz-borda)' }} />
        </radialGradient>
        <filter id={`${uid}-halo`} x="-80%" y="-40%" width="260%" height="180%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id={`${uid}-suave`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
      </defs>
      {CASARAO.regions.map((r, i) => (
        <g key={r.id} className="casarao__luz" data-luz={r.id} style={{ '--i': i } as CSSProperties}>
          <path className="casarao__halo" d={r.d} fill={`url(#${g})`} filter={`url(#${uid}-halo)`} />
          <path d={r.d} fill={`url(#${g})`} filter={`url(#${uid}-suave)`} />
        </g>
      ))}
    </svg>
  )
}

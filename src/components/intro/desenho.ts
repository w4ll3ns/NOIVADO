/**
 * Animação "o casarão se desenha": revela o traço da arte ponto a ponto, na ordem de um mapa
 * de tempo (public/brand/casarao-tempo.webp, gerado por scripts/art/casarao.py) em que a tinta
 * nasce no portão e corre pelas linhas do desenho.
 *
 * Canvas 2D puro: os pixels são ordenados uma única vez por tempo (bucket sort de 256 níveis)
 * e cada quadro só copia os que acabaram de nascer — leve até em celulares simples.
 * A tinta aparece dourada e "seca" para o sépia logo depois.
 */

const LEVELS = 256
/** Quantos níveis (de 256) a tinta leva para secar. */
const DRY = 22
const WET: [number, number, number] = [184, 132, 62]
/** Limite de pixels do canvas (celulares com tela muito densa). */
const MAX_PIXELS = 1_300_000

export type Desenho = {
  /** Resolve quando o desenho termina (ou é cancelado). */
  done: Promise<void>
  cancel: () => void
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`não carregou ${src}`))
    img.src = src
  })
}

export async function prepararDesenho(canvas: HTMLCanvasElement, arte: HTMLImageElement, tempoSrc: string) {
  const [tempo] = await Promise.all([loadImage(tempoSrc), arte.decode()])
  const rect = canvas.getBoundingClientRect()
  let scale = Math.min(window.devicePixelRatio || 1, 2)
  if (rect.width * rect.height * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (rect.width * rect.height))
  const w = Math.max(1, Math.round(rect.width * scale))
  const h = Math.max(1, Math.round(rect.height * scale))
  canvas.width = w
  canvas.height = h

  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const octx = off.getContext('2d', { willReadFrequently: true })
  const ctx = canvas.getContext('2d')
  if (!octx || !ctx) throw new Error('canvas indisponível')
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(arte, 0, 0, w, h)
  const art = octx.getImageData(0, 0, w, h).data
  octx.clearRect(0, 0, w, h)
  octx.drawImage(tempo, 0, 0, w, h)
  const time = octx.getImageData(0, 0, w, h).data

  // Ordena os pixels visíveis por tempo de nascimento.
  const starts = new Uint32Array(LEVELS + 1)
  for (let p = 0; p < art.length; p += 4) if (art[p + 3] > 0) starts[time[p] + 1]++
  for (let b = 0; b < LEVELS; b++) starts[b + 1] += starts[b]
  const order = new Uint32Array(starts[LEVELS])
  const fill = starts.slice(0, LEVELS)
  for (let p = 0; p < art.length; p += 4) if (art[p + 3] > 0) order[fill[time[p]]++] = p

  const out = ctx.createImageData(w, h)
  return { ctx, art, out, order, starts }
}

export function desenhar(prep: Awaited<ReturnType<typeof prepararDesenho>>, duracao: number): Desenho {
  const { ctx, art, out, order, starts } = prep
  const px = out.data
  let raf = 0
  let shown = 0 // níveis já revelados (molhados)
  let dried = 0 // níveis já secos
  let finish: () => void = () => {}
  const done = new Promise<void>((resolve) => (finish = resolve))

  const reveal = (upTo: number) => {
    for (; shown < upTo; shown++) {
      for (let k = starts[shown]; k < starts[shown + 1]; k++) {
        const p = order[k]
        px[p] = WET[0]
        px[p + 1] = WET[1]
        px[p + 2] = WET[2]
        px[p + 3] = art[p + 3]
      }
    }
  }
  const dry = (upTo: number) => {
    for (; dried < upTo; dried++) {
      for (let k = starts[dried]; k < starts[dried + 1]; k++) {
        const p = order[k]
        px[p] = art[p]
        px[p + 1] = art[p + 1]
        px[p + 2] = art[p + 2]
      }
    }
  }

  const t0 = performance.now()
  const frame = (now: number) => {
    const t = Math.min(1, (now - t0) / duracao)
    // a secagem vem DRY níveis atrás da tinta nova
    const pos = Math.floor(easeInOut(t) * (LEVELS + DRY))
    reveal(Math.min(pos, LEVELS))
    dry(Math.max(0, Math.min(pos - DRY, LEVELS)))
    ctx.putImageData(out, 0, 0)
    if (t < 1) raf = requestAnimationFrame(frame)
    else {
      reveal(LEVELS)
      dry(LEVELS)
      ctx.putImageData(out, 0, 0)
      finish()
    }
  }
  raf = requestAnimationFrame(frame)

  return {
    done,
    cancel: () => {
      cancelAnimationFrame(raf)
      finish()
    },
  }
}

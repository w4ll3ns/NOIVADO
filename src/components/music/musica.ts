/**
 * Música de fundo: um único <audio> para o site inteiro. Vive neste módulo (e não num
 * componente) para continuar tocando enquanto o convidado navega entre as páginas.
 *
 * Os navegadores só deixam tocar som depois de um toque do visitante: a abertura chama
 * `tocarDaAbertura()` no clique de "Entrar"/"Pular"; quem não passou pela abertura usa o botão ♪.
 */

/** Guardado quando o convidado pausa: nas próximas visitas a música não começa sozinha. */
const PREF = 'mc-musica'

let audio: HTMLAudioElement | null = null
let cfg: { src: string; volume: number } | null = null
let preparar = false
let pausadaAoSair = false
let fade = 0
const ouvintes = new Set<() => void>()

const avisar = () => ouvintes.forEach((f) => f())

function lembrarPausa(pausada: boolean) {
  try {
    if (pausada) localStorage.setItem(PREF, 'pausada')
    else localStorage.removeItem(PREF)
  } catch {
    /* modo privado: só não lembra */
  }
}

function pausadaPeloConvidado() {
  try {
    return localStorage.getItem(PREF) === 'pausada'
  } catch {
    return false
  }
}

function elemento() {
  if (!audio && cfg && typeof window !== 'undefined') {
    audio = new Audio()
    audio.loop = true
    audio.preload = preparar ? 'auto' : 'none'
    audio.src = cfg.src
    audio.addEventListener('play', avisar)
    audio.addEventListener('pause', avisar)
  }
  return audio
}

/** Sobe o volume aos poucos (no iPhone o volume é o do aparelho e isto não tem efeito). */
function subirVolume(a: HTMLAudioElement, alvo: number, ms: number) {
  cancelAnimationFrame(fade)
  const t0 = performance.now()
  const passo = (t: number) => {
    const k = Math.min(1, (t - t0) / ms)
    a.volume = alvo * k * k
    if (k < 1 && !a.paused) fade = requestAnimationFrame(passo)
  }
  fade = requestAnimationFrame(passo)
}

function tocar(msFade: number) {
  const a = elemento()
  if (!a || !cfg) return
  const alvo = cfg.volume
  a.volume = msFade ? 0 : alvo
  a.play().then(
    () => msFade && subirVolume(a, alvo, msFade),
    () => avisar(),
  )
}

/** Chamado pelo player (no layout do site) com a música configurada no painel. */
export function configurar(src: string, volume: number) {
  const v = Math.min(1, Math.max(0, volume / 100))
  if (cfg?.src === src) {
    cfg.volume = v
    if (audio && !audio.paused) audio.volume = v
    return
  }
  audio?.pause()
  audio = null
  cfg = { src, volume: v }
  if (preparar) elemento()
}

/** A abertura começou: já baixa a música para tocar sem atraso no "Entrar". */
export function prepararParaAbertura() {
  preparar = true
  const a = elemento()
  if (a && a.preload !== 'auto' && a.paused) {
    a.preload = 'auto'
    a.load()
  }
}

/** Clique em "Entrar" ou "Pular abertura" (precisa ser chamado dentro do clique). */
export function tocarDaAbertura() {
  if (!pausadaPeloConvidado()) tocar(2800)
}

/** Botão ♪. */
export function alternar() {
  const a = elemento()
  if (!a) return
  if (a.paused) {
    lembrarPausa(false)
    tocar(1200)
  } else {
    lembrarPausa(true)
    a.pause()
  }
}

export function tocando() {
  return !!audio && !audio.paused
}

export function assinar(fn: () => void) {
  ouvintes.add(fn)
  return () => {
    ouvintes.delete(fn)
  }
}

// Pausa quando o convidado troca de aplicativo ou bloqueia o celular; volta de onde parou.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!audio) return
    if (document.hidden && !audio.paused) {
      pausadaAoSair = true
      audio.pause()
    } else if (!document.hidden && pausadaAoSair) {
      pausadaAoSair = false
      audio.play().catch(() => avisar())
    }
  })
}

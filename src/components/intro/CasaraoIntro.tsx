'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { INTRO_STORAGE_KEY } from './constants'
import { desenhar, prepararDesenho, type Desenho } from './desenho'
import { iniciarParticulas } from './particulas'

/**
 * drawing  o casarão se desenha a traço (canvas)
 * lighting as janelas e o portão acendem, uma a uma
 * idle     esperando o "Entrar"
 * opening  a luz do portão cresce e a câmera entra por ele
 */
type Phase = 'drawing' | 'lighting' | 'idle' | 'opening' | 'welcome' | 'leaving' | 'done'

type Props = {
  names: ReactNode
  dateDots: string
  phrase: string
  buttonLabel: string
  welcomeTitle: string
  welcomeSub?: string
  /** Mostra mesmo que o dispositivo já tenha visto (ex.: "rever a abertura"). */
  force?: boolean
  /** O casarão (renderizado no servidor), com as luzes. */
  casarao: ReactNode
  /** Portão principal em frações da arte: centro (x, y) e tamanho (w, h). */
  porta: { x: number; y: number; w: number; h: number }
  /** Mapa de tempo do desenho. */
  tempoSrc: string
}

const DRAW_MS = 3400
/** Se as imagens demorarem mais que isso, pula o desenho e só acende as luzes. */
const LOAD_BUDGET_MS = 2600
const LIGHTS_MS = 1900

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function markSeen() {
  document.documentElement.classList.add('intro-seen')
  try {
    localStorage.setItem(INTRO_STORAGE_KEY, String(Date.now()))
  } catch {
    /* modo privado: tudo bem, apenas não lembramos */
  }
}

export function CasaraoIntro(props: Props) {
  const [phase, setPhase] = useState<Phase>('drawing')
  const [scripted, setScripted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const artRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dustRef = useRef<HTMLCanvasElement>(null)
  const poeira = useRef<ReturnType<typeof iniciarParticulas> | null>(null)
  const enterRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])
  const desenho = useRef<Desenho | null>(null)
  const phaseRef = useRef<Phase>('drawing')
  phaseRef.current = phase
  /** Decidido antes da pintura: este aparelho já viu a abertura. */
  const seenRef = useRef(false)

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  // Já viu neste aparelho? Some antes da pintura (navegação no cliente não roda o script inline).
  useIsoLayoutEffect(() => {
    if (props.force) {
      document.documentElement.classList.remove('intro-seen')
      return
    }
    let seen = false
    try {
      seen = !!localStorage.getItem(INTRO_STORAGE_KEY)
    } catch {
      seen = false
    }
    if (seen || document.documentElement.classList.contains('intro-seen')) {
      seenRef.current = true
      document.documentElement.classList.add('intro-seen')
      setPhase('done')
    }
  }, [props.force])

  // Desenho → luzes → espera o "Entrar".
  useEffect(() => {
    if (seenRef.current) return
    let cancelled = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lightUp = () => {
      if (cancelled || phaseRef.current !== 'drawing') return
      setPhase('lighting')
      later(reduced ? 0 : LIGHTS_MS, () => {
        if (phaseRef.current === 'lighting') setPhase('idle')
      })
    }
    const canvas = canvasRef.current
    const img = artRef.current?.querySelector<HTMLImageElement>('img.casarao__traco')
    // Se o JS chegou tarde e o plano B do CSS já mostrou a arte, não redesenha por cima.
    const shown = !!img && parseFloat(getComputedStyle(img).opacity) > 0.05
    if (reduced || shown || !canvas || !img) {
      lightUp()
      return () => {
        cancelled = true
      }
    }
    setScripted(true) // o JS assumiu o desenho: cancela o plano B do CSS
    const t0 = performance.now()
    prepararDesenho(canvas, img, props.tempoSrc)
      .then((prep) => {
        if (cancelled || phaseRef.current !== 'drawing') return
        if (performance.now() - t0 > LOAD_BUDGET_MS) return lightUp()
        const d = desenhar(prep, DRAW_MS)
        desenho.current = d
        return d.done.then(lightUp)
      })
      .catch(lightUp)
    return () => {
      cancelled = true
      desenho.current?.cancel()
    }
  }, [props.tempoSrc])

  useEffect(() => {
    if (phase === 'idle') enterRef.current?.focus({ preventScroll: true })
  }, [phase])

  // Poeira dourada na luz do portão, a partir do momento em que as luzes acendem.
  useEffect(() => {
    if (phase !== 'lighting' || poeira.current) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (dustRef.current) poeira.current = iniciarParticulas(dustRef.current, props.porta)
  }, [phase, props.porta])
  useEffect(() => () => poeira.current?.parar(), [])

  useEffect(() => clearTimers, [])

  const finish = useCallback(() => {
    markSeen()
    poeira.current?.parar()
    setPhase('done')
    document.getElementById('conteudo')?.focus({ preventScroll: true })
  }, [])

  const skip = useCallback(() => {
    clearTimers()
    desenho.current?.cancel()
    setPhase('leaving')
    later(420, finish)
  }, [finish])

  useEffect(() => {
    if (phase === 'done') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, skip])

  const enter = () => {
    if (phase === 'opening' || phase === 'welcome' || phase === 'leaving') return
    desenho.current?.cancel()
    clearTimers()
    poeira.current?.revoada()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = rootRef.current
    const stage = stageRef.current
    const art = artRef.current
    if (root && stage && art) {
      // A câmera mira o portão: origem da escala no centro dele, zoom até ele cobrir a tela.
      const s = stage.getBoundingClientRect()
      const a = art.getBoundingClientRect()
      const cx = a.left + a.width * props.porta.x
      const cy = a.top + a.height * props.porta.y
      const dw = a.width * props.porta.w
      const dh = a.height * props.porta.h
      const scale = Math.min(10, Math.max(window.innerWidth / dw, window.innerHeight / dh) * 0.75)
      stage.style.setProperty('--zoom-x', `${cx - s.left}px`)
      stage.style.setProperty('--zoom-y', `${cy - s.top}px`)
      stage.style.setProperty('--zoom-scale', String(scale))
      root.style.setProperty('--light-x', `${cx}px`)
      root.style.setProperty('--light-y', `${cy}px`)
    }
    setPhase('opening')
    if (reduced) {
      later(200, () => setPhase('welcome'))
      later(1700, () => setPhase('leaving'))
      later(2200, finish)
      return
    }
    later(2150, () => setPhase('welcome'))
    later(3550, () => setPhase('leaving'))
    later(4150, finish)
  }

  if (phase === 'done') return null

  const lit = phase !== 'drawing'
  const opening = phase === 'opening' || phase === 'welcome' || phase === 'leaving'
  const p = props.porta

  return (
    <div
      ref={rootRef}
      className={`intro${opening ? ' is-opening' : ''}`}
      data-phase={phase}
      data-lit={lit ? '' : undefined}
      data-scripted={scripted ? '' : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Abertura do convite"
    >
      <button type="button" className="intro__skip" onClick={skip}>
        Pular abertura <span aria-hidden="true">›</span>
      </button>

      <header className="intro__top">
        <p className="intro__names script">{props.names}</p>
        <p className="intro__date">{props.dateDots}</p>
      </header>

      <div className="intro__stage" ref={stageRef}>
        <div className="intro__casarao" ref={artRef}>
          {props.casarao}
          <canvas ref={canvasRef} className="intro__desenho" aria-hidden="true" />
          <canvas ref={dustRef} className="intro__poeira" aria-hidden="true" />
          <div
            className="intro__porta-luz"
            aria-hidden="true"
            style={
              {
                left: `${(p.x - p.w / 2) * 100}%`,
                top: `${(p.y - p.h / 2) * 100}%`,
                width: `${p.w * 100}%`,
                height: `${p.h * 100}%`,
              } as CSSProperties
            }
          />
        </div>
      </div>

      <footer className="intro__bottom">
        <p className="intro__phrase">“{props.phrase}”</p>
        <button ref={enterRef} type="button" className="btn btn--primary intro__enter" onClick={enter}>
          {props.buttonLabel}
        </button>
      </footer>

      <div className="intro__flood" aria-hidden="true" />
      <div className="intro__welcome" aria-live="polite">
        {phase === 'welcome' || phase === 'leaving' ? (
          <>
            <p className="intro__welcome-title">{props.welcomeTitle}</p>
            {props.welcomeSub ? <p className="intro__welcome-sub">{props.welcomeSub}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

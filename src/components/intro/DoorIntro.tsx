'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { INTRO_STORAGE_KEY } from './constants'


type Phase = 'idle' | 'opening' | 'welcome' | 'leaving' | 'done'

type Props = {
  names: ReactNode
  dateDots: string
  phrase: string
  buttonLabel: string
  welcomeTitle: string
  welcomeSub?: string
  /** Mostra mesmo que o dispositivo já tenha visto (ex.: "rever a abertura"). */
  force?: boolean
  facade: ReactNode
  leftLeaf: ReactNode
  rightLeaf: ReactNode
  door: { left: number; top: number; width: number; height: number }
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function markSeen() {
  document.documentElement.classList.add('intro-seen')
  try {
    localStorage.setItem(INTRO_STORAGE_KEY, String(Date.now()))
  } catch {
    /* modo privado: tudo bem, apenas não lembramos */
  }
}

export function DoorIntro(props: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const doorRef = useRef<HTMLDivElement>(null)
  const enterRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])

  // Navegação no cliente: o script inline não roda, então conferimos aqui antes da pintura.
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
      document.documentElement.classList.add('intro-seen')
      setPhase('done')
    } else {
      enterRef.current?.focus({ preventScroll: true })
    }
  }, [props.force])

  useEffect(() => {
    const list = timers.current
    return () => list.forEach((t) => window.clearTimeout(t))
  }, [])

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  const finish = useCallback(() => {
    markSeen()
    setPhase('done')
    const target = document.getElementById('conteudo')
    target?.focus({ preventScroll: true })
  }, [])

  const skip = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
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
    if (phase !== 'idle') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = rootRef.current
    const stage = stageRef.current
    const door = doorRef.current
    if (root && stage && door) {
      const s = stage.getBoundingClientRect()
      const d = door.getBoundingClientRect()
      const ox = d.left + d.width / 2 - s.left
      const oy = d.top + d.height * 0.45 - s.top
      const scale = Math.min(9, Math.max(window.innerWidth / d.width, window.innerHeight / d.height) * 0.9)
      stage.style.setProperty('--zoom-x', `${ox}px`)
      stage.style.setProperty('--zoom-y', `${oy}px`)
      stage.style.setProperty('--zoom-scale', String(scale))
      root.style.setProperty('--light-x', `${d.left + d.width / 2}px`)
      root.style.setProperty('--light-y', `${d.top + d.height * 0.45}px`)
    }
    setPhase('opening')
    if (reduced) {
      later(200, () => setPhase('welcome'))
      later(1700, () => setPhase('leaving'))
      later(2200, finish)
      return
    }
    later(2050, () => setPhase('welcome'))
    later(3450, () => setPhase('leaving'))
    later(4050, finish)
  }

  if (phase === 'done') return null

  const opening = phase !== 'idle'

  return (
    <div
      ref={rootRef}
      className={`intro${opening ? ' is-opening' : ''}`}
      data-phase={phase}
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
        <div className="intro__facade">
          {props.facade}
          <div
            ref={doorRef}
            className="intro__door"
            style={{
              left: `${props.door.left}%`,
              top: `${props.door.top}%`,
              width: `${props.door.width}%`,
              height: `${props.door.height}%`,
            }}
          >
            <div className="intro__leaf intro__leaf--l">{props.leftLeaf}</div>
            <div className="intro__leaf intro__leaf--r">{props.rightLeaf}</div>
          </div>
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

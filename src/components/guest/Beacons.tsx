'use client'

import { useEffect, useRef } from 'react'

/** Registra o acesso ao link do convite (somente navegadores reais executam isto). */
export function AccessBeacon({ token, preview }: { token: string; preview?: boolean }) {
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    fetch('/api/convite/acesso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, preview: !!preview }),
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {})
  }, [token, preview])
  return null
}

/** Registra que uma área relevante foi vista (quando entra na tela). */
export function ViewBeacon({ type, disabled }: { type: 'event_info_viewed' | 'gifts_viewed'; disabled?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (disabled || !ref.current) return
    const el = ref.current
    let done = false
    const send = () => {
      if (done) return
      done = true
      fetch('/api/convite/evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
        keepalive: true,
      }).catch(() => {})
    }
    if (!('IntersectionObserver' in window)) {
      send()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          window.setTimeout(send, 1200)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [type, disabled])
  return <span ref={ref} aria-hidden="true" style={{ display: 'block', height: 1 }} />
}

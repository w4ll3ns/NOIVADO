'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { alternar, assinar, configurar, tocando } from './musica'

/**
 * Botão ♪ fixo no canto: pausa e volta a tocar a música de fundo. Fica no layout do site,
 * então a música segue tocando entre as páginas.
 */
export function MusicPlayer({ src, volume }: { src: string; volume: number }) {
  useEffect(() => configurar(src, volume), [src, volume])
  const on = useSyncExternalStore(assinar, tocando, () => false)
  const label = on ? 'Pausar a música' : 'Tocar a música'
  return (
    <button
      type="button"
      className={`musica${on ? ' musica--on' : ''}`}
      onClick={alternar}
      aria-label={label}
      title={label}
    >
      {on ? (
        <span className="musica__barras" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      ) : (
        <svg className="musica__nota" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 18.5V5.5l10-2v12.5" />
          <ellipse cx="6.5" cy="18.5" rx="2.6" ry="2" />
          <ellipse cx="16.5" cy="16" rx="2.6" ry="2" />
        </svg>
      )}
    </button>
  )
}

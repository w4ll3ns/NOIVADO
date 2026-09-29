'use client'

import { useState, useSyncExternalStore } from 'react'
import { assinarSacola, escolher, MAX_ITENS, naSacola, tirar } from './sacola'

/** Botão do cartão do presente: põe e tira da lista "Seus presentes". */
export function EscolherPresente({ id, nome, sugeridoCents }: { id: string; nome: string; sugeridoCents: number | null }) {
  const escolhido = useSyncExternalStore(
    assinarSacola,
    () => naSacola(id),
    () => false,
  )
  const [cheia, setCheia] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`gift__escolher${escolhido ? ' is-on' : ''}`}
        aria-pressed={escolhido}
        aria-label={escolhido ? `${nome}: escolhido. Toque para tirar da sua lista` : `Escolher ${nome}`}
        onClick={() => {
          if (escolhido) return tirar(id)
          setCheia(!escolher(id, sugeridoCents))
        }}
      >
        {escolhido ? (
          <>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M4 10.5l4 4 8-9" />
            </svg>
            Escolhido
          </>
        ) : (
          'Escolher'
        )}
      </button>
      {cheia ? (
        <span className="field__hint" role="status">
          Até {MAX_ITENS} presentes por vez: finalize estes primeiro.
        </span>
      ) : null}
    </>
  )
}

'use client'

import { useRef, type ReactNode } from 'react'
import { EngravedIcon } from '@/components/ornaments/EngravedIcon'
import { Rule } from '@/components/ornaments/Ornaments'

type Props = {
  venue: string
  address: string
  mapsUrl: string
  wazeUrl: string
  className?: string
  /** O conteúdo do botão (ícone, título e subtítulo). */
  children: ReactNode
}

/**
 * Botão "Localização": abre uma janela com o nome do local e as opções Google Maps e Waze.
 * Sem JavaScript, o link leva direto ao Google Maps.
 */
export function LocalButton({ venue, address, mapsUrl, wazeUrl, className, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const close = () => ref.current?.close()
  return (
    <>
      <a
        href={mapsUrl}
        className={className}
        aria-haspopup="dialog"
        onClick={(e) => {
          if (!ref.current?.showModal) return
          e.preventDefault()
          ref.current.showModal()
        }}
      >
        {children}
      </a>
      <dialog
        ref={ref}
        className="local-modal"
        aria-labelledby="local-modal-titulo"
        // Clicar fora da caixa (no fundo escurecido) fecha.
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        <div className="local-modal__box">
          <button type="button" className="local-modal__fechar" onClick={close} aria-label="Fechar">
            ×
          </button>
          <p className="local-modal__eyebrow">Localização</p>
          <h3 id="local-modal-titulo" className="local-modal__titulo">
            {venue}
          </h3>
          {address ? <p className="local-modal__sub">{address}</p> : null}
          <Rule className="local-modal__rule" />
          <div className="local-modal__opcoes">
            <a className="btn btn--primary" href={mapsUrl} target="_blank" rel="noopener noreferrer" onClick={close}>
              <EngravedIcon name="mapa" />
              Google Maps
            </a>
            <a className="btn" href={wazeUrl} target="_blank" rel="noopener noreferrer" onClick={close}>
              <EngravedIcon name="pin" />
              Waze
            </a>
          </div>
        </div>
      </dialog>
    </>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { formatBRL } from '@/lib/format'
import type { MensagemPagamento } from './Pagamento'

type Props = {
  /** versao: muda a cada pedido enviado (dados novos → iframe novo, mesmo se o pedido for o mesmo). */
  pedido: { ref: string; totalCents: number; versao: number }
  aberto: boolean
  onFechar: () => void
}

/**
 * Pix e cartão numa janela sobre o "Finalizar presentes", sem sair da página (a música continua).
 * O conteúdo vem de /pagar/[ref] num iframe, que tem a própria política de segurança para o
 * formulário do Mercado Pago. Fechar não perde nada: o iframe continua montado (com o Pix gerado).
 */
export function ModalPagamento({ pedido, aberto, onFechar }: Props) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const chave = `${pedido.ref}:${pedido.versao}`
  /** O iframe que já carregou. */
  const [carregou, setCarregou] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  useEffect(() => {
    const ouvir = (e: MessageEvent<MensagemPagamento>) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      if (e.data?.tipo === 'mc-pago') {
        ref.current?.close()
        router.push(`/presentes/retorno?ref=${encodeURIComponent(e.data.ref)}`)
      } else if (e.data?.tipo === 'mc-fechar') {
        onFechar()
      }
    }
    window.addEventListener('message', ouvir)
    return () => window.removeEventListener('message', ouvir)
  }, [router, onFechar])

  return (
    <dialog
      ref={ref}
      className="pag-modal"
      aria-labelledby="pag-modal-titulo"
      onClose={onFechar}
      // Clicar no fundo escurecido fecha (no celular a janela ocupa a tela toda).
      onClick={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div className="pag-modal__topo">
        <div>
          <p className="pag-modal__eyebrow" id="pag-modal-titulo">
            Pagamento
          </p>
          <p className="pag-modal__total">{formatBRL(pedido.totalCents)}</p>
        </div>
        <button type="button" className="pag-modal__fechar" onClick={onFechar} aria-label="Fechar o pagamento">
          ×
        </button>
      </div>
      <div className="pag-modal__corpo">
        {carregou !== chave ? (
          <p className="pag-modal__carregando" role="status">
            <span className="pix__pulso" aria-hidden="true" />
            Preparando o pagamento…
          </p>
        ) : null}
        <iframe
          key={chave}
          ref={frame}
          src={`/pagar/${pedido.ref}`}
          title="Pagamento com Pix ou cartão de crédito"
          className="pag-modal__frame"
          allow="payment; clipboard-write"
          onLoad={() => setCarregou(chave)}
        />
      </div>
    </dialog>
  )
}

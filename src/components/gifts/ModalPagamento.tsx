'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { formatBRL } from '@/lib/format'
import { Pagamento, type TelaPagamento } from './Pagamento'
import { pagarComCartao } from './pagarComCartao'

type Props = {
  tela: TelaPagamento
  aberto: boolean
  onFechar: () => void
}

/**
 * Pagamento numa janela sobre o "Finalizar presentes", sem sair da página (a música continua):
 * Pix aqui mesmo; cartão na página do Mercado Pago. Fechar não perde nada — a tela continua
 * montada (com o Pix gerado) e reabre igual.
 */
export function ModalPagamento({ tela, aberto, onFechar }: Props) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  const cartao = useMemo(() => pagarComCartao.bind(null, tela.orderRef), [tela.orderRef])
  const pago = useCallback(() => {
    ref.current?.close()
    router.push(`/presentes/retorno?ref=${encodeURIComponent(tela.orderRef)}`)
  }, [router, tela.orderRef])

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
          <p className="pag-modal__total">{formatBRL(tela.totalCents)}</p>
        </div>
        <button type="button" className="pag-modal__fechar" onClick={onFechar} aria-label="Fechar o pagamento">
          ×
        </button>
      </div>
      <div className="pag-modal__corpo">
        <Pagamento {...tela} cartao={cartao} onPago={pago} />
      </div>
    </dialog>
  )
}

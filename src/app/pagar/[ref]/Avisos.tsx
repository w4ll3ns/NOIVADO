'use client'

import { useEffect } from 'react'
import { avisarPagina, type MensagemPagamento } from '@/components/gifts/Pagamento'

/** Aberta fora do modal (link copiado, por exemplo): vai para a página de pagamento normal. */
export function SoNoModal({ orderRef }: { orderRef: string }) {
  useEffect(() => {
    if (window.top === window) window.location.replace(`/presentes/pagamento/${orderRef}`)
  }, [orderRef])
  return null
}

/** Avisa a página do "Finalizar presentes" assim que abre (ex.: o pedido já estava pago). */
export function AvisarAoAbrir({ msg }: { msg: MensagemPagamento }) {
  useEffect(() => avisarPagina(msg), [msg])
  return null
}

export function BotaoFechar() {
  return (
    <button type="button" className="btn btn--block" onClick={() => avisarPagina({ tipo: 'mc-fechar' })}>
      Voltar aos presentes
    </button>
  )
}

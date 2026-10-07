'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { esvaziarSacola, substituirSacola, type ItemSacola } from '@/components/gifts/sacola'

/** Pedido pago (ou aguardando o Pix): a lista "Seus presentes" deste aparelho é esvaziada. */
export function EsvaziarSacola() {
  useEffect(() => esvaziarSacola(), [])
  return null
}

/** Pagamento não concluído: volta os mesmos presentes para a lista e abre "Finalizar". */
export function TentarDeNovo({ itens }: { itens: ItemSacola[] }) {
  const router = useRouter()
  return (
    <button
      type="button"
      className="btn btn--primary"
      onClick={() => {
        substituirSacola(itens)
        router.push('/presentes/finalizar')
      }}
    >
      Tentar novamente
    </button>
  )
}

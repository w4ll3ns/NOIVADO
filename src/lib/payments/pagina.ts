import 'server-only'

import { getSettings } from '@/lib/settings'
import type { TelaPagamento } from '@/components/gifts/Pagamento'
import { currentPix, getOrder, orderReadyToPay, PaymentError, type GiftOrder } from './service'

export type DadosPagamento = {
  order: GiftOrder
  /** Por que o pedido não pode ser pago agora (substituído, prazo vencido, presente esgotado…). */
  problem: string | null
  /** O que a tela de pagamento (Pix e cartão) precisa. */
  tela: TelaPagamento
}

/** Dados da tela de pagamento de um pedido (página própria e modal do "Finalizar presentes"). */
export async function dadosPagamento(ref: string): Promise<DadosPagamento | null> {
  const settings = await getSettings()
  if (!settings.gifts.enabled) return null
  const order = await getOrder(ref)
  if (!order || order.provider !== 'mercadopago') return null
  let problem: string | null = null
  if (order.status !== 'approved' && order.status !== 'refunded') {
    try {
      await orderReadyToPay(ref)
    } catch (err) {
      if (!(err instanceof PaymentError)) throw err
      problem = err.message
    }
  }
  const pix = problem || order.status !== 'awaiting' ? null : await currentPix(order)
  return {
    order,
    problem,
    tela: {
      orderRef: order.reference,
      totalCents: order.totalCents,
      maxInstallments: settings.gifts.maxInstallments,
      pixAtual: pix,
      tentativaRecusada: order.status === 'rejected',
    },
  }
}

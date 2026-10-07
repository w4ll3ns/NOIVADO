import 'server-only'

import { env } from '@/lib/env'
import { getSettings } from '@/lib/settings'
import { currentPix, getOrder, orderReadyToPay, PaymentError, transparentCheckout, type GiftOrder, type PixView } from './service'

export type DadosPagamento = {
  order: GiftOrder
  /** Por que o pedido não pode ser pago agora (substituído, prazo vencido, presente esgotado…). */
  problem: string | null
  /** O que a tela de pagamento (Pix e cartão) precisa. */
  tela: {
    orderRef: string
    totalCents: number
    publicKey: string | null
    email: string
    maxInstallments: number
    pixAtual: PixView | null
    tentativaRecusada: boolean
  }
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
      publicKey: transparentCheckout() ? env.mpPublicKey : null,
      email: order.rows[0].payerEmail,
      maxInstallments: settings.gifts.maxInstallments,
      pixAtual: pix,
      tentativaRecusada: order.status === 'rejected',
    },
  }
}

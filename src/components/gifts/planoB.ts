'use server'

import { checkoutProUrl, orderReadyToPay, PaymentError } from '@/lib/payments/service'

/** `url`: a página do Mercado Pago; o cliente abre na janela inteira (mesmo de dentro do modal). */
export type FallbackState = { error?: string; url?: string }

/** Plano B: se o formulário do cartão não carregar aqui, paga na página do Mercado Pago. */
export async function pagarNoMercadoPago(ref: string, _prev: FallbackState): Promise<FallbackState> {
  try {
    await orderReadyToPay(ref)
    return { url: await checkoutProUrl(ref) }
  } catch (err) {
    if (err instanceof PaymentError) return { error: err.message }
    console.error('Falha ao abrir o Checkout Pro', err)
    return { error: 'Não conseguimos abrir o Mercado Pago agora. Tente de novo em instantes.' }
  }
}

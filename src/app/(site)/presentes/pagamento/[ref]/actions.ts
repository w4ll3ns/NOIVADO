'use server'

import { redirect } from 'next/navigation'
import { checkoutProUrl, orderReadyToPay, PaymentError } from '@/lib/payments/service'

export type FallbackState = { error?: string }

/** Plano B: se o formulário do cartão não carregar aqui, paga na página do Mercado Pago. */
export async function pagarNoMercadoPago(ref: string, _prev: FallbackState): Promise<FallbackState> {
  let url: string
  try {
    await orderReadyToPay(ref)
    url = await checkoutProUrl(ref)
  } catch (err) {
    if (err instanceof PaymentError) return { error: err.message }
    console.error('Falha ao abrir o Checkout Pro', err)
    return { error: 'Não conseguimos abrir o Mercado Pago agora. Tente de novo em instantes.' }
  }
  redirect(url)
}

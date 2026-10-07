'use server'

import { cookies } from 'next/headers'
import { getPublicGifts, ORDER_COOKIE, resolveGiftAmount } from '@/lib/gifts'
import { getCurrentGuest } from '@/lib/invitations'
import { getSettings } from '@/lib/settings'
import { env } from '@/lib/env'
import { cleanLine, cleanText, isEmail } from '@/lib/sanitize'
import { normalizePhone } from '@/lib/format'
import { MAX_ORDER_ITEMS, PaymentError, startGiftOrder } from '@/lib/payments/service'
import { dadosPagamento } from '@/lib/payments/pagina'
import type { TelaPagamento } from '@/components/gifts/Pagamento'
import { clientIp, hashIp } from '@/lib/request'
import { rateLimit } from '@/lib/security/rate-limit'

export type FinalizarState = {
  error?: string
  /** Presentes que não estão mais disponíveis (o cliente tira da lista). */
  indisponiveis?: string[]
  values?: { name: string; email: string; phone: string; message: string }
  /**
   * Para onde o navegador vai (página de pagamento do site ou do Mercado Pago). O cliente abre com
   * carregamento completo: a página de pagamento traz a própria política de segurança (CSP), que
   * libera o formulário do Mercado Pago; numa navegação interna valeria a da página anterior.
   */
  ir?: string
  /** O pedido abre no modal de pagamento, sem sair desta página (Pix aqui; cartão no Mercado Pago). */
  pagar?: TelaPagamento
}

export async function finalizarPresentesAction(_prev: FinalizarState, form: FormData): Promise<FinalizarState> {
  const values = {
    name: cleanLine(form.get('name'), 100),
    email: cleanLine(form.get('email'), 200).toLowerCase(),
    phone: cleanLine(form.get('phone'), 30),
    message: cleanText(form.get('message'), 1500),
  }
  const settings = await getSettings()
  if (!settings.gifts.enabled) return { error: 'A lista de presentes está fechada no momento.', values }

  let pedidos: { id: string; cents: number | null }[]
  try {
    const bruto: unknown = JSON.parse(String(form.get('itens') ?? '[]'))
    if (!Array.isArray(bruto)) throw new Error()
    pedidos = bruto.map((x) => ({ id: String(x?.id ?? ''), cents: Number.isInteger(x?.cents) ? Number(x.cents) : null }))
  } catch {
    return { error: 'Não conseguimos ler a sua lista. Recarregue a página e tente de novo.', values }
  }
  if (!pedidos.length) return { error: 'Escolha pelo menos um presente.', values }
  if (pedidos.length > MAX_ORDER_ITEMS) return { error: `Escolha até ${MAX_ORDER_ITEMS} presentes por vez.`, values }

  const gifts = await getPublicGifts(pedidos.map((p) => p.id))
  const indisponiveis = pedidos.filter((p) => !gifts.some((g) => g.id === p.id && g.avail.available)).map((p) => p.id)
  if (indisponiveis.length) {
    return {
      error:
        indisponiveis.length === 1
          ? 'Um dos presentes acabou de ser escolhido por outra pessoa e saiu da sua lista. Confira e finalize de novo.'
          : 'Alguns presentes acabaram de ser escolhidos por outras pessoas e saíram da sua lista. Confira e finalize de novo.',
      indisponiveis,
      values,
    }
  }

  const items: { gift: (typeof gifts)[number]; amountCents: number }[] = []
  for (const gift of gifts) {
    const amount = resolveGiftAmount(gift, pedidos.find((p) => p.id === gift.id)!.cents)
    if (amount.error !== null) return { error: `${gift.name}: ${amount.error}`, values }
    items.push({ gift, amountCents: amount.cents })
  }

  if (values.name.length < 2) return { error: 'Conte para nós o seu nome.', values }
  if (!isEmail(values.email)) return { error: 'Informe um e-mail válido — o Mercado Pago envia o comprovante para ele.', values }
  const phone = values.phone ? normalizePhone(values.phone) : null
  if (values.phone && !phone) return { error: 'Confira o telefone informado (ou deixe em branco).', values }

  if (!(await rateLimit(`gift:${hashIp(await clientIp())}`, 12, 3600))) {
    return { error: 'Muitas tentativas em pouco tempo. Tente novamente mais tarde.', values }
  }

  const jar = await cookies()
  const guest = await getCurrentGuest()
  try {
    const res = await startGiftOrder({
      items,
      payerName: values.name,
      payerEmail: values.email,
      payerPhone: phone,
      message: values.message || null,
      invitationId: guest?.invitation.id ?? null,
      // Pedido deste navegador ainda não pago: se o convidado voltar e finalizar de novo, ele é trocado.
      replaceOrderId: jar.get(ORDER_COOKIE)?.value ?? null,
    })
    jar.set(ORDER_COOKIE, res.orderId, { httpOnly: true, sameSite: 'lax', secure: env.isProduction, path: '/', maxAge: 60 * 60 * 24 })
    const dados = res.redirectUrl.startsWith('/presentes/pagamento/') ? await dadosPagamento(res.orderId) : null
    if (!dados) return { ir: res.redirectUrl, values }
    if (dados.problem) return { error: dados.problem, values }
    return { pagar: dados.tela, values }
  } catch (err) {
    if (err instanceof PaymentError) return { error: err.message, values }
    console.error(err)
    return { error: 'Não conseguimos iniciar o pagamento agora. Tente novamente em instantes.', values }
  }
}

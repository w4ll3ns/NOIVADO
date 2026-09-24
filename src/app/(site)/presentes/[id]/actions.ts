'use server'

import { redirect } from 'next/navigation'
import { getPublicGift, resolveGiftAmount } from '@/lib/gifts'
import { getCurrentGuest } from '@/lib/invitations'
import { getSettings } from '@/lib/settings'
import { cleanLine, cleanText, isEmail } from '@/lib/sanitize'
import { normalizePhone, parseBRLToCents } from '@/lib/format'
import { PaymentError, startGiftPayment } from '@/lib/payments/service'
import { clientIp, hashIp } from '@/lib/request'
import { rateLimit } from '@/lib/security/rate-limit'

export type GiftFormState = {
  error?: string
  values?: { name: string; email: string; phone: string; message: string; amount: string }
}

export async function giveGiftAction(giftId: string, _prev: GiftFormState, form: FormData): Promise<GiftFormState> {
  const values = {
    name: cleanLine(form.get('name'), 100),
    email: cleanLine(form.get('email'), 200).toLowerCase(),
    phone: cleanLine(form.get('phone'), 30),
    message: cleanText(form.get('message'), 1500),
    amount: cleanLine(form.get('amount'), 20),
  }
  const settings = await getSettings()
  if (!settings.gifts.enabled) return { error: 'A lista de presentes está fechada no momento.', values }
  const gift = await getPublicGift(giftId)
  if (!gift) return { error: 'Este presente não está mais disponível.', values }
  if (!gift.avail.available) return { error: 'Este presente acabou de ser escolhido. Que tal outra ideia da lista?', values }

  const amount = resolveGiftAmount(gift, parseBRLToCents(values.amount))
  if (amount.error !== null) return { error: amount.error, values }
  if (values.name.length < 2) return { error: 'Conte para nós o seu nome.', values }
  if (!isEmail(values.email)) return { error: 'Informe um e-mail válido — o Mercado Pago envia o comprovante para ele.', values }
  const phone = values.phone ? normalizePhone(values.phone) : null
  if (values.phone && !phone) return { error: 'Confira o telefone informado (ou deixe em branco).', values }

  if (!(await rateLimit(`gift:${hashIp(await clientIp())}`, 12, 3600))) {
    return { error: 'Muitas tentativas em pouco tempo. Tente novamente mais tarde.', values }
  }

  const guest = await getCurrentGuest()
  let redirectUrl: string
  try {
    const res = await startGiftPayment({
      gift,
      amountCents: amount.cents,
      payerName: values.name,
      payerEmail: values.email,
      payerPhone: phone,
      message: values.message || null,
      invitationId: guest?.invitation.id ?? null,
    })
    redirectUrl = res.redirectUrl
  } catch (err) {
    if (err instanceof PaymentError) return { error: err.message, values }
    console.error(err)
    return { error: 'Não conseguimos iniciar o presente agora. Tente novamente em instantes.', values }
  }
  redirect(redirectUrl)
}

import { PaymentError, payOrderWithCard } from '@/lib/payments/service'
import { clientIpFrom, hashIp, isSameOrigin } from '@/lib/request'
import { rateLimit } from '@/lib/security/rate-limit'

type Body = {
  ref?: unknown
  attempt?: unknown
  deviceId?: unknown
  formData?: {
    token?: unknown
    payment_method_id?: unknown
    issuer_id?: unknown
    installments?: unknown
    payer?: { email?: unknown; identification?: { type?: unknown; number?: unknown } }
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * Pagamento com cartão de crédito sem sair do site. O formulário seguro do Mercado Pago gera um
 * token de uso único: o número do cartão nunca chega aqui. O valor vem do pedido, não do navegador.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return Response.json({ error: 'Origem inválida' }, { status: 403 })
  const body = (await req.json().catch(() => null)) as Body | null
  const ref = str(body?.ref, 40)
  const f = body?.formData
  const token = str(f?.token, 200)
  const paymentMethodId = str(f?.payment_method_id, 40)
  if (!/^[0-9a-f-]{36}$/i.test(ref) || !token || !/^[a-z0-9_]+$/i.test(paymentMethodId)) {
    return Response.json({ error: 'Dados do pagamento incompletos. Tente de novo.' }, { status: 400 })
  }
  const ip = hashIp(clientIpFrom(req.headers))
  if (!(await rateLimit(`card:${ip}`, 15, 600)) || !(await rateLimit(`card:${ref}`, 8, 600))) {
    return Response.json({ error: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos ou pague com Pix.' }, { status: 429 })
  }
  const idType = str(f?.payer?.identification?.type, 10)
  const idNumber = str(f?.payer?.identification?.number, 20).replace(/\D/g, '')
  try {
    const result = await payOrderWithCard(ref, {
      token,
      paymentMethodId,
      issuerId: str(f?.issuer_id, 20) || (typeof f?.issuer_id === 'number' ? String(f.issuer_id) : null),
      installments: Number(f?.installments),
      email: str(f?.payer?.email, 200).toLowerCase(),
      identification: idType && idNumber ? { type: idType, number: idNumber } : null,
      deviceId: str(body?.deviceId, 200) || null,
      attempt: str(body?.attempt, 60).replace(/[^A-Za-z0-9_-]/g, '') || String(Date.now()),
    })
    return Response.json(result)
  } catch (err) {
    if (err instanceof PaymentError) return Response.json({ error: err.message }, { status: 409 })
    console.error('Falha no pagamento com cartão', err)
    return Response.json({ error: 'Não conseguimos falar com o Mercado Pago agora. Tente de novo em instantes ou pague com Pix.' }, { status: 502 })
  }
}

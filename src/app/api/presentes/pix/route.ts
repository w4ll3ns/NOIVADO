import { PaymentError, payOrderWithPix } from '@/lib/payments/service'
import { clientIpFrom, hashIp, isSameOrigin } from '@/lib/request'
import { rateLimit } from '@/lib/security/rate-limit'

/** Gera o Pix do pedido (ou devolve o que ainda vale), para pagar sem sair do site. */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return Response.json({ error: 'Origem inválida' }, { status: 403 })
  const body = (await req.json().catch(() => null)) as { ref?: unknown; cpf?: unknown } | null
  const ref = typeof body?.ref === 'string' ? body.ref : ''
  const cpf = typeof body?.cpf === 'string' ? body.cpf.slice(0, 20) : ''
  if (!/^[0-9a-f-]{36}$/i.test(ref)) return Response.json({ error: 'Pedido inválido.' }, { status: 400 })
  const ip = hashIp(clientIpFrom(req.headers))
  if (!(await rateLimit(`pix:${ip}`, 20, 600)) || !(await rateLimit(`pix:${ref}`, 8, 600))) {
    return Response.json({ error: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos.' }, { status: 429 })
  }
  try {
    return Response.json(await payOrderWithPix(ref, cpf))
  } catch (err) {
    if (err instanceof PaymentError) return Response.json({ error: err.message }, { status: 409 })
    console.error('Falha ao gerar o Pix', err)
    return Response.json({ error: 'Não conseguimos gerar o Pix agora. Tente de novo em instantes.' }, { status: 502 })
  }
}

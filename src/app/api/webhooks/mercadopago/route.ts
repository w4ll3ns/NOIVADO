import { env } from '@/lib/env'
import { verifyWebhookSignature } from '@/lib/payments/mercadopago'
import { processMpNotification } from '@/lib/payments/service'
import { clientIpFrom, hashIp } from '@/lib/request'
import { rateLimit } from '@/lib/security/rate-limit'

/**
 * Webhook do Mercado Pago.
 * 1. valida a assinatura (x-signature) quando MP_WEBHOOK_SECRET está configurado;
 * 2. NUNCA confia no corpo: consulta o pagamento na API com o nosso access token;
 * 3. aplica o status de forma idempotente (payment_events.dedupe_key).
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  if (!(await rateLimit(`mp-webhook:${hashIp(clientIpFrom(req.headers))}`, 600, 60))) {
    return new Response('Too Many Requests', { status: 429 })
  }
  const body = (await req.json().catch(() => null)) as { type?: string; action?: string; data?: { id?: string | number } } | null
  const type = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? body?.type ?? ''
  const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id') ?? (body?.data?.id != null ? String(body.data.id) : null)

  const secret = env.mpWebhookSecret
  if (secret) {
    const valid = verifyWebhookSignature({
      signatureHeader: req.headers.get('x-signature'),
      requestId: req.headers.get('x-request-id'),
      dataId: url.searchParams.get('data.id') ?? dataId,
      secret,
      toleranceSeconds: 60 * 60 * 24,
    })
    if (!valid) return new Response('Assinatura inválida', { status: 401 })
  } else if (env.isProduction) {
    console.warn('MP_WEBHOOK_SECRET não configurado: notificação aceita, mas o status será confirmado na API do Mercado Pago.')
  }

  if (type !== 'payment' || !dataId || !/^\d{1,30}$/.test(dataId)) {
    // Outros tópicos (merchant_order etc.) não são necessários: confirmamos pelo pagamento.
    return new Response('ok', { status: 200 })
  }

  try {
    await processMpNotification(dataId)
    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('Erro ao processar webhook do Mercado Pago', err)
    // 500 faz o Mercado Pago tentar novamente mais tarde.
    return new Response('erro', { status: 500 })
  }
}

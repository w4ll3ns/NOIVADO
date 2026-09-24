import { createHmac } from 'node:crypto'
import type { PaymentStatus } from '@/lib/db/schema'
import { safeEqual } from '@/lib/security/tokens'

/**
 * Cliente mínimo da API oficial do Mercado Pago (Checkout Pro).
 * Nenhum dado de cartão passa pelo nosso servidor: o pagamento acontece no ambiente do MP.
 */

const API = 'https://api.mercadopago.com'

export type MpPayment = {
  id: number
  status: string
  status_detail?: string | null
  external_reference?: string | null
  transaction_amount: number
  currency_id: string
  payment_method_id?: string | null
  payment_type_id?: string | null
  date_created?: string | null
  date_approved?: string | null
  date_last_updated?: string | null
  live_mode?: boolean
}

export type MpPreference = { id: string; init_point: string; sandbox_init_point?: string }

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
  }
}

async function mpFetch<T>(accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new MercadoPagoError(`Mercado Pago ${res.status}: ${text.slice(0, 300)}`, res.status)
  }
  return (await res.json()) as T
}

export type PreferenceInput = {
  externalReference: string
  title: string
  description?: string | null
  amountCents: number
  payer: { name: string; email: string }
  appUrl: string
  maxInstallments: number
  statementDescriptor?: string
  expiresAt: Date
}

export function buildPreferenceBody(input: PreferenceInput) {
  const https = input.appUrl.startsWith('https://')
  const back = `${input.appUrl}/presentes/retorno?ref=${input.externalReference}`
  const [firstName, ...rest] = input.payer.name.trim().split(/\s+/)
  return {
    items: [
      {
        id: input.externalReference,
        title: input.title.slice(0, 250),
        description: (input.description ?? input.title).slice(0, 250),
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Math.round(input.amountCents) / 100,
        category_id: 'others',
      },
    ],
    payer: { name: firstName, surname: rest.join(' ') || undefined, email: input.payer.email },
    external_reference: input.externalReference,
    metadata: { gift_payment_id: input.externalReference },
    back_urls: { success: back, pending: back, failure: back },
    ...(https
      ? {
          auto_return: 'approved',
          // `source_news=webhooks`: recebe apenas Webhooks (não IPN) — formato assinado com x-signature.
          notification_url: `${input.appUrl}/api/webhooks/mercadopago?source_news=webhooks`,
        }
      : {}),
    payment_methods: { installments: input.maxInstallments },
    statement_descriptor: input.statementDescriptor?.slice(0, 13) || undefined,
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: input.expiresAt.toISOString(),
    binary_mode: false,
  }
}

export async function createPreference(accessToken: string, input: PreferenceInput): Promise<MpPreference> {
  return mpFetch<MpPreference>(accessToken, '/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': input.externalReference },
    body: JSON.stringify(buildPreferenceBody(input)),
  })
}

export async function getPayment(accessToken: string, id: string | number): Promise<MpPayment> {
  if (!/^\d{1,30}$/.test(String(id))) throw new MercadoPagoError('ID de pagamento inválido')
  return mpFetch<MpPayment>(accessToken, `/v1/payments/${id}`)
}

export async function searchPaymentsByReference(accessToken: string, externalReference: string): Promise<MpPayment[]> {
  const q = new URLSearchParams({ external_reference: externalReference, sort: 'date_created', criteria: 'desc', limit: '10' })
  const res = await mpFetch<{ results: MpPayment[] }>(accessToken, `/v1/payments/search?${q}`)
  return res.results ?? []
}

/** Status do Mercado Pago → status interno. */
export function mapMpStatus(status: string, detail?: string | null): PaymentStatus {
  switch (status) {
    case 'approved':
      return 'approved'
    case 'authorized':
    case 'pending':
    case 'in_process':
    case 'in_mediation':
      return 'awaiting'
    case 'rejected':
      return 'rejected'
    case 'cancelled':
      return detail === 'expired' ? 'expired' : 'cancelled'
    case 'refunded':
    case 'charged_back':
      return 'refunded'
    default:
      return 'awaiting'
  }
}

/**
 * Valida o cabeçalho `x-signature` das notificações (HMAC-SHA256).
 * Manifesto: `id:{data.id};request-id:{x-request-id};ts:{ts};` (partes ausentes são omitidas).
 */
export function verifyWebhookSignature(opts: {
  signatureHeader: string | null
  requestId: string | null
  dataId: string | null
  secret: string
  toleranceSeconds?: number
  now?: number
}): boolean {
  if (!opts.signatureHeader) return false
  const parts = Object.fromEntries(
    opts.signatureHeader.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=')
      return [k, v.join('=')]
    }),
  )
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false
  if (opts.toleranceSeconds) {
    const tsMs = ts.length > 11 ? Number(ts) : Number(ts) * 1000
    const now = opts.now ?? Date.now()
    if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > opts.toleranceSeconds * 1000) return false
  }
  const id = opts.dataId ? (/^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId) : null
  let manifest = ''
  if (id) manifest += `id:${id};`
  if (opts.requestId) manifest += `request-id:${opts.requestId};`
  manifest += `ts:${ts};`
  const expected = createHmac('sha256', opts.secret).update(manifest).digest('hex')
  return safeEqual(expected, v1.toLowerCase())
}

import { createHmac } from 'node:crypto'
import type { PaymentStatus } from '@/lib/db/schema'
import { safeEqual } from '@/lib/security/tokens'

/**
 * Cliente mínimo da API oficial do Mercado Pago (Checkout Pro).
 * Nenhum dado de cartão passa pelo nosso servidor: o pagamento acontece no ambiente do MP.
 */

/** API oficial. MP_API_BASE só serve para testes com um servidor simulado. */
const API = (process.env.MP_API_BASE || 'https://api.mercadopago.com').replace(/\/+$/, '')

/**
 * Só Pix e cartão de crédito: estes tipos saem do checkout quando existem na conta.
 * (Saldo em conta e carteira do Mercado Pago não podem ser excluídos numa preferência.)
 */
const NOT_ACCEPTED_TYPES = ['ticket', 'atm', 'debit_card', 'prepaid_card', 'digital_currency']
/** Boleto: a exclusão documentada, usada quando não dá para consultar os meios da conta. */
export const SAFE_EXCLUDED_TYPES = ['ticket']

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

export type PreferenceItem = { id: string; title: string; description?: string | null; amountCents: number }

export type PreferenceInput = {
  /** O pedido (vários presentes pagos juntos). */
  externalReference: string
  items: PreferenceItem[]
  payer: { name: string; email: string }
  appUrl: string
  maxInstallments: number
  statementDescriptor?: string
  expiresAt: Date
  /** Tipos de pagamento fora do checkout (padrão: boleto). */
  excludedPaymentTypes?: string[]
}

/** Data no formato que o Mercado Pago documenta: 2026-10-20T23:59:59.000-03:00 (horário de Brasília). */
export function mpDate(d: Date) {
  const local = new Date(d.getTime() - 3 * 3600_000)
  return `${local.toISOString().slice(0, 23)}-03:00`
}

export function buildPreferenceBody(input: PreferenceInput) {
  const https = input.appUrl.startsWith('https://')
  const back = `${input.appUrl}/presentes/retorno?ref=${input.externalReference}`
  const [firstName, ...rest] = input.payer.name.trim().split(/\s+/)
  return {
    items: input.items.map((it) => ({
      id: it.id,
      title: it.title.slice(0, 250),
      description: (it.description || it.title).slice(0, 250),
      quantity: 1,
      currency_id: 'BRL',
      unit_price: Math.round(it.amountCents) / 100,
      category_id: 'others',
    })),
    payer: { name: firstName, surname: rest.join(' ') || undefined, email: input.payer.email },
    external_reference: input.externalReference,
    metadata: { gift_order_id: input.externalReference },
    back_urls: { success: back, pending: back, failure: back },
    ...(https
      ? {
          auto_return: 'approved',
          // `source_news=webhooks`: recebe apenas Webhooks (não IPN) — formato assinado com x-signature.
          notification_url: `${input.appUrl}/api/webhooks/mercadopago?source_news=webhooks`,
        }
      : {}),
    payment_methods: {
      installments: input.maxInstallments,
      excluded_payment_types: (input.excludedPaymentTypes ?? SAFE_EXCLUDED_TYPES).map((id) => ({ id })),
    },
    statement_descriptor: input.statementDescriptor?.slice(0, 13) || undefined,
    expires: true,
    expiration_date_from: mpDate(new Date()),
    expiration_date_to: mpDate(input.expiresAt),
    // Prazo do Pix = fim da reserva dos presentes: depois disso o Mercado Pago não aceita o pagamento.
    date_of_expiration: mpDate(input.expiresAt),
    binary_mode: false,
  }
}

export async function createPreference(accessToken: string, input: PreferenceInput, idempotencyKey = input.externalReference): Promise<MpPreference> {
  return mpFetch<MpPreference>(accessToken, '/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': idempotencyKey },
    body: JSON.stringify(buildPreferenceBody(input)),
  })
}

export type MpPaymentMethod = { id: string; name?: string; payment_type_id: string; status?: string }

/** Meios de pagamento disponíveis para a conta do access token. */
export async function listPaymentMethods(accessToken: string): Promise<MpPaymentMethod[]> {
  return mpFetch<MpPaymentMethod[]>(accessToken, '/v1/payment_methods')
}

/** Dos meios da conta, os tipos a tirar do checkout (só existem Pix e cartão de crédito no fim). */
export function typesToExclude(methods: MpPaymentMethod[]) {
  const present = new Set(methods.filter((m) => m.status !== 'inactive').map((m) => m.payment_type_id))
  const types = NOT_ACCEPTED_TYPES.filter((t) => present.has(t))
  return types.length ? types : SAFE_EXCLUDED_TYPES
}

export type MpAccount = { id: number; nickname?: string; email?: string; site_id?: string }

/** Dono do access token (para conferir no painel a qual conta o site está ligado). */
export async function getAccount(accessToken: string): Promise<MpAccount> {
  return mpFetch<MpAccount>(accessToken, '/users/me')
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

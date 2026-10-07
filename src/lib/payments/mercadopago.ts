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
  date_of_expiration?: string | null
  live_mode?: boolean
  /** Pix: QR Code e "copia e cola". */
  point_of_interaction?: { transaction_data?: { qr_code?: string | null; qr_code_base64?: string | null; ticket_url?: string | null } } | null
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

/* ------------------------------------------------------------------ */
/* Checkout no próprio site (API de pagamentos)                         */
/* ------------------------------------------------------------------ */

type PaymentCommon = {
  orderId: string
  amountCents: number
  description: string
  appUrl: string
  items: { id: string; title: string; amountCents: number }[]
  payerName: string
  /** Só dígitos, com o 55 do Brasil (normalizePhone); ajuda o antifraude a aprovar o cartão. */
  payerPhone?: string | null
}

function nameParts(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/)
  return { first_name: first || undefined, last_name: rest.join(' ') || undefined }
}

/** "5598999999999" → { area_code: "98", number: "999999999" } (só telefones do Brasil). */
function phoneParts(phone?: string | null) {
  const m = phone?.match(/^55(\d{2})(\d{8,9})$/)
  return m ? { area_code: m[1], number: m[2] } : undefined
}

function common(input: PaymentCommon) {
  const https = input.appUrl.startsWith('https://')
  const phone = phoneParts(input.payerPhone)
  return {
    transaction_amount: Math.round(input.amountCents) / 100,
    description: input.description.slice(0, 250),
    external_reference: input.orderId,
    metadata: { gift_order_id: input.orderId },
    ...(https ? { notification_url: `${input.appUrl}/api/webhooks/mercadopago?source_news=webhooks` } : {}),
    // Quanto mais completo, mais o antifraude do Mercado Pago aprova (itens, categoria, comprador).
    additional_info: {
      items: input.items.map((it) => ({
        id: it.id,
        title: it.title.slice(0, 250),
        description: it.title.slice(0, 250),
        category_id: 'others',
        quantity: 1,
        unit_price: Math.round(it.amountCents) / 100,
      })),
      payer: { ...nameParts(input.payerName), ...(phone ? { phone } : {}) },
    },
  }
}

/** Pix gerado aqui: o Mercado Pago devolve o QR Code e o "copia e cola". */
export function buildPixPaymentBody(input: PaymentCommon & { payerEmail: string; cpf: string; expiresAt: Date }) {
  return {
    ...common(input),
    payment_method_id: 'pix',
    date_of_expiration: mpDate(input.expiresAt),
    payer: {
      email: input.payerEmail,
      ...nameParts(input.payerName),
      identification: { type: 'CPF', number: input.cpf },
    },
  }
}

/** Cartão de crédito: o token vem do formulário seguro do Mercado Pago (o número do cartão nunca passa por aqui). */
export function buildCardPaymentBody(
  input: PaymentCommon & {
    token: string
    installments: number
    paymentMethodId: string
    issuerId: string | null
    payer: { email: string; identification: { type: string; number: string } | null }
    statementDescriptor?: string
  },
) {
  return {
    ...common(input),
    token: input.token,
    installments: input.installments,
    payment_method_id: input.paymentMethodId,
    ...(input.issuerId ? { issuer_id: input.issuerId } : {}),
    payer: { email: input.payer.email, ...nameParts(input.payerName), ...(input.payer.identification ? { identification: input.payer.identification } : {}) },
    statement_descriptor: input.statementDescriptor?.slice(0, 13) || undefined,
    // Sem modo binário: o que o Mercado Pago quiser analisar fica "em análise" (o convidado vê
    // "aguardando a confirmação") em vez de ser recusado na hora — o modo binário reduz a aprovação.
    binary_mode: false,
  }
}

export async function createPayment(
  accessToken: string,
  body: Record<string, unknown>,
  opts: { idempotencyKey: string; deviceId?: string | null },
): Promise<MpPayment> {
  return mpFetch<MpPayment>(accessToken, '/v1/payments', {
    method: 'POST',
    headers: {
      'X-Idempotency-Key': opts.idempotencyKey,
      ...(opts.deviceId && /^[A-Za-z0-9_-]{8,200}$/.test(opts.deviceId) ? { 'X-meli-session-id': opts.deviceId } : {}),
    },
    body: JSON.stringify(body),
  })
}

/** Cancela um pagamento pendente (ex.: o Pix gerado antes de o convidado pagar no cartão). */
export async function cancelPayment(accessToken: string, id: string | number) {
  if (!/^\d{1,30}$/.test(String(id))) throw new MercadoPagoError('ID de pagamento inválido')
  return mpFetch<MpPayment>(accessToken, `/v1/payments/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) })
}

/**
 * Motivos de recusa do cartão (status_detail do Mercado Pago): o que dizer ao convidado e o resumo
 * que aparece no painel, em Pagamentos.
 */
const REJECTIONS: Record<string, { guest: string; admin: string }> = {
  cc_rejected_bad_filled_card_number: { guest: 'Confira o número do cartão.', admin: 'número do cartão errado' },
  cc_rejected_bad_filled_date: { guest: 'Confira a data de validade do cartão.', admin: 'validade errada' },
  cc_rejected_bad_filled_security_code: { guest: 'Confira o código de segurança (CVV) do cartão.', admin: 'CVV errado' },
  cc_rejected_bad_filled_other: { guest: 'Confira os dados do cartão.', admin: 'dados do cartão errados' },
  cc_rejected_call_for_authorize: {
    guest: 'O seu banco pediu uma autorização: ligue para o banco, autorize o pagamento e tente de novo.',
    admin: 'o banco pediu autorização ao titular',
  },
  cc_rejected_card_disabled: { guest: 'Este cartão está desativado. Ative com o banco ou use outro cartão.', admin: 'cartão desativado' },
  cc_rejected_duplicated_payment: {
    guest: 'Já existe um pagamento igual a este. Se não foi você, tente com outro cartão.',
    admin: 'pagamento duplicado',
  },
  cc_rejected_insufficient_amount: {
    guest: 'O cartão não tem limite suficiente. Tente outro cartão ou pague com Pix.',
    admin: 'limite insuficiente',
  },
  cc_rejected_invalid_installments: {
    guest: 'Este cartão não aceita esse número de parcelas. Escolha outro.',
    admin: 'parcelas não aceitas pelo cartão',
  },
  cc_rejected_max_attempts: { guest: 'Muitas tentativas com este cartão. Use outro cartão ou pague com Pix.', admin: 'tentativas demais' },
  cc_rejected_high_risk: {
    guest: 'O Mercado Pago não aprovou este pagamento por segurança. Tente outro cartão ou pague com Pix.',
    admin: 'antifraude do Mercado Pago (alto risco)',
  },
  cc_rejected_blacklist: { guest: 'Este cartão não pode ser usado. Tente outro cartão ou pague com Pix.', admin: 'cartão bloqueado no Mercado Pago' },
  cc_rejected_other_reason: {
    guest: 'O banco do cartão recusou o pagamento. Tente outro cartão, fale com o banco ou pague com Pix.',
    admin: 'recusado pelo banco do cartão',
  },
  cc_rejected_by_bank: {
    guest: 'O banco do cartão recusou o pagamento. Tente outro cartão, fale com o banco ou pague com Pix.',
    admin: 'recusado pelo banco do cartão',
  },
  cc_rejected_card_error: { guest: 'O cartão não conseguiu processar o pagamento. Tente de novo ou use outro cartão.', admin: 'erro no cartão' },
  cc_rejected_3ds_mandatory: {
    guest: 'O banco do cartão exigiu uma verificação extra. Tente outro cartão ou pague com Pix.',
    admin: 'o banco exigiu 3DS (verificação extra)',
  },
  cc_rejected_3ds_challenge: {
    guest: 'A verificação do banco não foi concluída. Tente de novo, use outro cartão ou pague com Pix.',
    admin: 'verificação 3DS não concluída',
  },
  cc_amount_rate_limit_exceeded: {
    guest: 'O cartão atingiu o limite para este tipo de compra. Tente outro cartão ou pague com Pix.',
    admin: 'limite do meio de pagamento atingido',
  },
  cc_rejected_insufficient_data: {
    guest: 'Faltaram dados para aprovar. Confira o nome e o CPF do titular e tente de novo.',
    admin: 'dados do titular insuficientes',
  },
  rejected_insufficient_data: {
    guest: 'Faltaram dados para aprovar. Confira o nome e o CPF do titular e tente de novo.',
    admin: 'dados do titular insuficientes',
  },
  cc_rejected_card_type_not_allowed: { guest: 'Este tipo de cartão não é aceito. Use um cartão de crédito.', admin: 'tipo de cartão não aceito' },
  rejected_by_bank: {
    guest: 'O banco do cartão recusou o pagamento. Tente outro cartão, fale com o banco ou pague com Pix.',
    admin: 'recusado pelo banco do cartão',
  },
  rejected_high_risk: {
    guest: 'O Mercado Pago não aprovou este pagamento por segurança. Tente outro cartão ou pague com Pix.',
    admin: 'antifraude do Mercado Pago (alto risco)',
  },
  rejected_by_regulations: { guest: 'O pagamento foi recusado pelas regras do Mercado Pago. Pague com Pix.', admin: 'regras do Mercado Pago' },
}

/** Cartão recusado: o que dizer ao convidado. */
export function cardRejectionMessage(detail?: string | null) {
  return (detail && REJECTIONS[detail]?.guest) || 'O pagamento não foi aprovado. Tente outro cartão ou pague com Pix.'
}

/** Cartão recusado: o motivo no painel (com o código do Mercado Pago, para conferir lá). */
export function rejectionReason(detail?: string | null) {
  if (!detail) return null
  const known = REJECTIONS[detail]?.admin
  return known ? `${known} (${detail})` : detail
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

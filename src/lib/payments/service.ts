import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { db, schema, type Tx } from '@/lib/db'
import { env } from '@/lib/env'
import { getSettings } from '@/lib/settings'
import { logInvitationEvent } from '@/lib/invitations'
import { availabilityOf, giftCounts, type Gift } from '@/lib/gifts'
import type { PaymentStatus } from '@/lib/db/schema'
import {
  createPreference,
  getAccount,
  getPayment,
  listPaymentMethods,
  mapMpStatus,
  MercadoPagoError,
  SAFE_EXCLUDED_TYPES,
  searchPaymentsByReference,
  typesToExclude,
  type MpPayment,
  type PreferenceInput,
} from './mercadopago'
import { nextStatus } from './transitions'

export type GiftPayment = typeof schema.giftPayments.$inferSelect

const PREFERENCE_HOURS = 24

export class PaymentError extends Error {}

type OrderInput = {
  items: { gift: Gift; amountCents: number }[]
  payerName: string
  payerEmail: string
  payerPhone: string | null
  message: string | null
  invitationId: string | null
  /** Pedido anterior deste navegador ainda não pago: é substituído (libera a reserva dos presentes). */
  replaceOrderId?: string | null
}

export const MAX_ORDER_ITEMS = 20

/**
 * Inicia um pedido com um ou mais presentes: reserva, registra (uma linha por presente, todas com
 * o mesmo `orderId`) e cria UMA preferência no Mercado Pago com um item por presente.
 * Retorna a URL do ambiente seguro do Mercado Pago (ou da simulação em desenvolvimento).
 */
export async function startGiftOrder(input: OrderInput): Promise<{ orderId: string; redirectUrl: string }> {
  const simulation = env.paymentsSimulation
  const accessToken = env.mpAccessToken
  if (!simulation && !accessToken) {
    throw new PaymentError('Os presentes estarão disponíveis em breve. Tente novamente mais tarde.')
  }
  if (!input.items.length) throw new PaymentError('Escolha pelo menos um presente.')
  if (input.items.length > MAX_ORDER_ITEMS) throw new PaymentError(`Escolha até ${MAX_ORDER_ITEMS} presentes por vez.`)
  if (new Set(input.items.map((i) => i.gift.id)).size !== input.items.length) throw new PaymentError('Há um presente repetido na sua lista.')

  const orderId = randomUUID()
  const rows = await db.transaction(async (tx) => {
    const ids = input.items.map((i) => i.gift.id).sort()
    // Trava os presentes (sempre na mesma ordem) para evitar duas reservas simultâneas do último item.
    await tx.execute(sql`select id from gifts where id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) order by id for update`)
    if (input.replaceOrderId && UUID.test(input.replaceOrderId)) {
      // Nenhuma tentativa de pagamento no Mercado Pago ainda: pode ser trocado pelo pedido novo.
      await tx
        .update(schema.giftPayments)
        .set({ status: 'cancelled', statusDetail: 'replaced_by_new_order', updatedAt: new Date() })
        .where(
          and(
            eq(schema.giftPayments.orderId, input.replaceOrderId),
            eq(schema.giftPayments.status, 'awaiting'),
            isNull(schema.giftPayments.mpPaymentId),
          ),
        )
    }
    const counts = await giftCounts(ids, tx)
    for (const { gift } of input.items) {
      if (!availabilityOf(gift, counts.get(gift.id)).available) {
        throw new PaymentError(`“${gift.name}” acabou de ser escolhido por outra pessoa. Tire-o da sua lista para continuar.`)
      }
    }
    const expiresAt = new Date(Date.now() + PREFERENCE_HOURS * 3600_000)
    const inserted = await tx
      .insert(schema.giftPayments)
      .values(
        input.items.map((it, i) => ({
          orderId,
          giftId: it.gift.id,
          invitationId: input.invitationId,
          giftName: it.gift.name,
          payerName: input.payerName,
          payerEmail: input.payerEmail,
          payerPhone: input.payerPhone,
          // A mensagem é uma só por pedido: chega aos noivos uma vez.
          message: i === 0 ? input.message : null,
          amountCents: it.amountCents,
          provider: simulation ? ('simulation' as const) : ('mercadopago' as const),
          expiresAt,
        })),
      )
      .returning()
    if (input.invitationId) {
      for (const row of inserted) {
        await logInvitationEvent(
          input.invitationId,
          'gift_selected',
          { data: { gift: row.giftName, amountCents: row.amountCents, paymentId: row.id, orderId } },
          tx,
        )
      }
    }
    return inserted
  })

  if (simulation) return { orderId, redirectUrl: `/presentes/simulacao/${orderId}` }

  const settings = await getSettings()
  try {
    const pref = await createPreferenceOnlyPixAndCard(accessToken!, {
      externalReference: orderId,
      items: rows.map((row) => {
        const gift = input.items.find((i) => i.gift.id === row.giftId)!.gift
        return {
          id: row.id,
          title: `Presente para ${settings.event.coupleNames}: ${gift.name}`,
          description: gift.description,
          amountCents: row.amountCents,
        }
      }),
      payer: { name: input.payerName, email: input.payerEmail },
      appUrl: env.appUrl,
      maxInstallments: settings.gifts.maxInstallments,
      statementDescriptor: settings.gifts.statementDescriptor,
      expiresAt: rows[0].expiresAt!,
    })
    const url = process.env.MP_USE_SANDBOX === 'true' && pref.sandbox_init_point ? pref.sandbox_init_point : pref.init_point
    await db
      .update(schema.giftPayments)
      .set({ mpPreferenceId: pref.id, checkoutUrl: url, updatedAt: new Date() })
      .where(eq(schema.giftPayments.orderId, orderId))
    return { orderId, redirectUrl: url }
  } catch (err) {
    console.error('Falha ao criar preferência no Mercado Pago', err)
    await db
      .update(schema.giftPayments)
      .set({ status: 'cancelled', statusDetail: 'preference_error', updatedAt: new Date() })
      .where(eq(schema.giftPayments.orderId, orderId))
    throw new PaymentError('Não conseguimos abrir o pagamento agora. Tente novamente em alguns instantes.')
  }
}

/** Tipos de pagamento fora do checkout, por conta (consultados no Mercado Pago a cada 6 h). */
let excludedCache: { token: string; types: string[]; at: number } | null = null

async function excludedTypes(token: string) {
  if (excludedCache && excludedCache.token === token && Date.now() - excludedCache.at < 6 * 3600_000) return excludedCache.types
  try {
    const types = typesToExclude(await listPaymentMethods(token))
    excludedCache = { token, types, at: Date.now() }
    return types
  } catch (err) {
    console.error('Não foi possível consultar os meios de pagamento da conta; o checkout tira só o boleto.', err)
    return SAFE_EXCLUDED_TYPES
  }
}

/**
 * Checkout só com Pix e cartão de crédito. Se o Mercado Pago recusar alguma exclusão (400), tenta
 * de novo com menos exclusões — sem o Mercado Crédito (a menos documentada) e, por fim, só sem o
 * boleto: o pagamento nunca fica indisponível por causa disso. A que der certo fica guardada.
 */
async function createPreferenceOnlyPixAndCard(token: string, input: Omit<PreferenceInput, 'excludedPaymentTypes'>) {
  const types = await excludedTypes(token)
  const attempts = [types, types.filter((t) => t !== 'digital_currency'), SAFE_EXCLUDED_TYPES].filter(
    (set, i, all) => set.length && all.findIndex((o) => o.join() === set.join()) === i,
  )
  for (const [i, set] of attempts.entries()) {
    try {
      const pref = await createPreference(token, { ...input, excludedPaymentTypes: set }, i ? `${input.externalReference}:${i}` : undefined)
      if (i) excludedCache = { token, types: set, at: Date.now() }
      return pref
    } catch (err) {
      const last = i === attempts.length - 1
      if (last || !(err instanceof MercadoPagoError) || err.status !== 400) throw err
      console.error(`O Mercado Pago recusou excluir ${set.join(', ')}; tentando com menos exclusões.`, err.message)
    }
  }
  throw new PaymentError('Não conseguimos abrir o pagamento agora.')
}

export type MercadoPagoStatus =
  | { connected: false; reason: 'sem_token' | 'token_recusado' | 'sem_conexao'; detail?: string }
  | {
      connected: true
      account: { nickname: string | null; email: string | null }
      production: boolean
      pix: boolean | null
      cards: string[]
      webhookSecret: boolean
      webhookUrl: string
      httpsOk: boolean
    }

/** Para o painel: a qual conta o site está ligado e o que o checkout vai aceitar. */
export async function mercadoPagoStatus(): Promise<MercadoPagoStatus> {
  const token = env.mpAccessToken
  if (!token) return { connected: false, reason: 'sem_token' }
  let account
  try {
    account = await getAccount(token)
  } catch (err) {
    if (err instanceof MercadoPagoError && (err.status === 401 || err.status === 403)) {
      return { connected: false, reason: 'token_recusado' }
    }
    return { connected: false, reason: 'sem_conexao', detail: err instanceof Error ? err.message.slice(0, 160) : undefined }
  }
  const methods = await listPaymentMethods(token).catch(() => null)
  return {
    connected: true,
    account: { nickname: account.nickname ?? null, email: account.email ?? null },
    production: token.startsWith('APP_USR-'),
    pix: methods ? methods.some((m) => m.id === 'pix' && m.status !== 'inactive') : null,
    cards: methods ? methods.filter((m) => m.payment_type_id === 'credit_card' && m.status !== 'inactive').map((m) => m.name || m.id) : [],
    webhookSecret: !!env.mpWebhookSecret,
    webhookUrl: `${env.appUrl}/api/webhooks/mercadopago`,
    httpsOk: env.appUrl.startsWith('https://'),
  }
}

const UUID = /^[0-9a-f-]{36}$/i

/**
 * As linhas de um `external_reference`: todas as do pedido (pagamentos novos) ou a única linha
 * com esse id (pagamentos antigos, de um presente só).
 */
async function rowsOfReference(ref: string, executor: Tx | typeof db = db, lock = false) {
  const p = schema.giftPayments
  const byOrder = executor.select().from(p).where(eq(p.orderId, ref)).orderBy(asc(p.createdAt), asc(p.id))
  let rows = lock ? await byOrder.for('update') : await byOrder
  if (!rows.length) {
    const byId = executor.select().from(p).where(eq(p.id, ref))
    rows = lock ? await byId.for('update') : await byId
  }
  return rows
}

/**
 * Aplica o estado de um pagamento consultado NA API do Mercado Pago (nunca no corpo do webhook)
 * a todas as linhas do pedido. Idempotente: cada combinação (pagamento, status, detalhe,
 * atualização) é processada uma única vez.
 */
export async function applyMpPayment(mp: MpPayment, source: 'webhook' | 'return' | 'sync' | 'simulation') {
  const ref = mp.external_reference
  if (!ref || !UUID.test(ref)) return { handled: false, reason: 'external_reference ausente' }
  const mpId = String(mp.id)
  const incoming = mapMpStatus(mp.status, mp.status_detail)
  const dedupeKey = `mp:${mpId}:${mp.status}:${mp.status_detail ?? ''}:${mp.date_last_updated ?? ''}`

  return db.transaction(async (tx) => {
    const rows = await rowsOfReference(ref, tx, true)
    const inserted = await tx
      .insert(schema.paymentEvents)
      .values({
        paymentId: rows[0]?.id ?? null,
        source,
        dedupeKey,
        mpPaymentId: mpId,
        mpStatus: mp.status,
        mpStatusDetail: mp.status_detail ?? null,
        data: {
          reference: ref,
          amount: mp.transaction_amount,
          currency: mp.currency_id,
          method: mp.payment_method_id ?? null,
          type: mp.payment_type_id ?? null,
          liveMode: mp.live_mode ?? null,
        },
      })
      .onConflictDoNothing({ target: schema.paymentEvents.dedupeKey })
      .returning({ id: schema.paymentEvents.id })
    if (!inserted.length) return { handled: false, reason: 'duplicado' }
    if (!rows.length) return { handled: false, reason: 'pagamento desconhecido' }

    const ids = rows.map((r) => r.id)
    const expected = rows.reduce((sum, r) => sum + r.amountCents, 0) / 100
    if (mp.currency_id !== 'BRL' || Math.abs(mp.transaction_amount - expected) > 0.009) {
      await tx
        .update(schema.giftPayments)
        .set({ statusDetail: `amount_mismatch:${mp.transaction_amount}`, updatedAt: new Date() })
        .where(inArray(schema.giftPayments.id, ids))
      console.error(`Valor divergente no pagamento ${ref}: esperado ${expected}, recebido ${mp.transaction_amount}`)
      return { handled: false, reason: 'valor divergente' }
    }

    const now = new Date()
    let finalStatus: PaymentStatus = rows[0].status
    for (const payment of rows) {
      const target = nextStatus(payment, { status: incoming, mpPaymentId: mpId })
      if (!target) continue
      finalStatus = target
      const becameApproved = target === 'approved' && payment.status !== 'approved'
      await tx
        .update(schema.giftPayments)
        .set({
          status: target,
          statusDetail: mp.status_detail ?? null,
          mpPaymentId: mpId,
          paymentMethod: mp.payment_method_id ?? payment.paymentMethod,
          paymentType: mp.payment_type_id ?? payment.paymentType,
          approvedAt: becameApproved ? (mp.date_approved ? new Date(mp.date_approved) : now) : payment.approvedAt,
          updatedAt: now,
        })
        .where(eq(schema.giftPayments.id, payment.id))

      if (payment.invitationId) {
        if (becameApproved) {
          await logInvitationEvent(payment.invitationId, 'payment_approved', { actor: 'system', data: { gift: payment.giftName, amountCents: payment.amountCents } }, tx)
        } else if (target === 'rejected') {
          await logInvitationEvent(payment.invitationId, 'payment_failed', { actor: 'system', data: { gift: payment.giftName, detail: mp.status_detail } }, tx)
        } else if (target === 'refunded') {
          await logInvitationEvent(payment.invitationId, 'payment_refunded', { actor: 'system', data: { gift: payment.giftName } }, tx)
        }
      }

      // A mensagem do presente só chega aos noivos quando o pagamento é aprovado.
      if (becameApproved && payment.message && !payment.messageDelivered) {
        await tx.insert(schema.messages).values({
          invitationId: payment.invitationId,
          source: 'gift',
          authorName: payment.payerName,
          content: payment.message,
          paymentId: payment.id,
        })
        await tx.update(schema.giftPayments).set({ messageDelivered: true }).where(eq(schema.giftPayments.id, payment.id))
        if (payment.invitationId) {
          await logInvitationEvent(payment.invitationId, 'message_sent', { data: { source: 'gift' } }, tx)
        }
      }
    }
    return { handled: true, status: finalStatus }
  })
}

/** Processa uma notificação (webhook): busca o pagamento na API e aplica. */
export async function processMpNotification(mpPaymentId: string) {
  const token = env.mpAccessToken
  if (!token) throw new MercadoPagoError('MP_ACCESS_TOKEN não configurado')
  const mp = await getPayment(token, mpPaymentId)
  return applyMpPayment(mp, 'webhook')
}

/**
 * Consulta ativa (página de retorno / admin): procura pagamentos pela referência externa.
 * Aceita o id do pedido ou de uma linha (o admin lista presente por presente).
 */
export async function syncPaymentWithMp(idOrOrder: string, source: 'return' | 'sync' = 'sync') {
  const token = env.mpAccessToken
  if (!token || !UUID.test(idOrOrder)) return
  const [row] = await rowsOfReference(idOrOrder)
  if (!row) return
  const reference = row.orderId ?? row.id
  try {
    const results = await searchPaymentsByReference(token, reference)
    // Mais antigos primeiro, para o estado final refletir o mais recente.
    for (const mp of results.reverse()) await applyMpPayment(mp, source)
  } catch (err) {
    console.error('Falha ao sincronizar pagamento', reference, err)
  }
}

/** Preferências vencidas sem nenhuma tentativa de pagamento viram "Expirado". */
export async function expireStalePayments() {
  await db
    .update(schema.giftPayments)
    .set({ status: 'expired', statusDetail: 'preference_expired', updatedAt: new Date() })
    .where(
      and(
        eq(schema.giftPayments.status, 'awaiting'),
        isNull(schema.giftPayments.mpPaymentId),
        lt(schema.giftPayments.expiresAt, new Date()),
      ),
    )
}

/** Somente desenvolvimento: simula a resposta do Mercado Pago. */
export async function simulatePayment(ref: string, outcome: 'approved' | 'rejected' | 'pending') {
  if (!env.paymentsSimulation) throw new PaymentError('Simulação desativada.')
  const order = await getOrder(ref)
  if (!order || order.provider !== 'simulation') throw new PaymentError('Pagamento não encontrado.')
  const now = new Date().toISOString()
  return applyMpPayment(
    {
      id: Number(`9${Date.now()}`.slice(0, 15)),
      status: outcome,
      status_detail: outcome === 'approved' ? 'accredited' : outcome === 'rejected' ? 'cc_rejected_other_reason' : 'pending_waiting_transfer',
      external_reference: order.reference,
      transaction_amount: order.totalCents / 100,
      currency_id: 'BRL',
      payment_method_id: 'pix',
      payment_type_id: 'bank_transfer',
      date_approved: outcome === 'approved' ? now : null,
      date_last_updated: now,
    },
    'simulation',
  )
}

export type GiftOrder = {
  /** O `external_reference`: id do pedido (ou da linha, nos pagamentos antigos). */
  reference: string
  rows: GiftPayment[]
  status: PaymentStatus
  totalCents: number
  provider: GiftPayment['provider']
  checkoutUrl: string | null
}

/** Um pedido (vários presentes pagos juntos) pela referência da URL de retorno. */
export async function getOrder(ref: string): Promise<GiftOrder | null> {
  if (!UUID.test(ref)) return null
  const rows = await rowsOfReference(ref)
  if (!rows.length) return null
  return {
    reference: rows[0].orderId ?? rows[0].id,
    rows,
    status: rows[0].status,
    totalCents: rows.reduce((sum, r) => sum + r.amountCents, 0),
    provider: rows[0].provider,
    checkoutUrl: rows[0].checkoutUrl,
  }
}

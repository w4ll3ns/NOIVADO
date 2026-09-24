import 'server-only'
import { and, eq, isNull, lt, sql } from 'drizzle-orm'
import { db, schema, type Tx } from '@/lib/db'
import { env } from '@/lib/env'
import { getSettings } from '@/lib/settings'
import { logInvitationEvent } from '@/lib/invitations'
import { availabilityOf, giftCounts, type Gift } from '@/lib/gifts'
import type { PaymentStatus } from '@/lib/db/schema'
import {
  createPreference,
  getPayment,
  mapMpStatus,
  MercadoPagoError,
  searchPaymentsByReference,
  type MpPayment,
} from './mercadopago'
import { nextStatus } from './transitions'

export type GiftPayment = typeof schema.giftPayments.$inferSelect

const PREFERENCE_HOURS = 24

export class PaymentError extends Error {}

type StartInput = {
  gift: Gift
  amountCents: number
  payerName: string
  payerEmail: string
  payerPhone: string | null
  message: string | null
  invitationId: string | null
}

/**
 * Inicia um presente: reserva, registra e cria a preferência no Mercado Pago.
 * Retorna a URL do ambiente seguro do Mercado Pago (ou da simulação em desenvolvimento).
 */
export async function startGiftPayment(input: StartInput): Promise<{ paymentId: string; redirectUrl: string }> {
  const simulation = env.paymentsSimulation
  const accessToken = env.mpAccessToken
  if (!simulation && !accessToken) {
    throw new PaymentError('Os presentes estarão disponíveis em breve. Tente novamente mais tarde.')
  }

  const payment = await db.transaction(async (tx) => {
    // Trava o presente para evitar duas reservas simultâneas do último item.
    await tx.execute(sql`select id from gifts where id = ${input.gift.id} for update`)
    const counts = await giftCountsTx(tx, input.gift.id)
    if (!availabilityOf(input.gift, counts).available) {
      throw new PaymentError('Este presente acabou de ser escolhido por outra pessoa. Que tal outra ideia da lista?')
    }
    const [row] = await tx
      .insert(schema.giftPayments)
      .values({
        giftId: input.gift.id,
        invitationId: input.invitationId,
        giftName: input.gift.name,
        payerName: input.payerName,
        payerEmail: input.payerEmail,
        payerPhone: input.payerPhone,
        message: input.message,
        amountCents: input.amountCents,
        provider: simulation ? 'simulation' : 'mercadopago',
        expiresAt: new Date(Date.now() + PREFERENCE_HOURS * 3600_000),
      })
      .returning()
    if (input.invitationId) {
      await logInvitationEvent(
        input.invitationId,
        'gift_selected',
        { data: { gift: input.gift.name, amountCents: input.amountCents, paymentId: row.id } },
        tx,
      )
    }
    return row
  })

  if (simulation) {
    return { paymentId: payment.id, redirectUrl: `/presentes/simulacao/${payment.id}` }
  }

  const settings = await getSettings()
  try {
    const pref = await createPreference(accessToken!, {
      externalReference: payment.id,
      title: `Presente para ${settings.event.coupleNames}: ${input.gift.name}`,
      description: input.gift.description,
      amountCents: input.amountCents,
      payer: { name: input.payerName, email: input.payerEmail },
      appUrl: env.appUrl,
      maxInstallments: settings.gifts.maxInstallments,
      statementDescriptor: settings.gifts.statementDescriptor,
      expiresAt: payment.expiresAt!,
    })
    const url = process.env.MP_USE_SANDBOX === 'true' && pref.sandbox_init_point ? pref.sandbox_init_point : pref.init_point
    await db
      .update(schema.giftPayments)
      .set({ mpPreferenceId: pref.id, checkoutUrl: url, updatedAt: new Date() })
      .where(eq(schema.giftPayments.id, payment.id))
    return { paymentId: payment.id, redirectUrl: url }
  } catch (err) {
    console.error('Falha ao criar preferência no Mercado Pago', err)
    await db
      .update(schema.giftPayments)
      .set({ status: 'cancelled', statusDetail: 'preference_error', updatedAt: new Date() })
      .where(eq(schema.giftPayments.id, payment.id))
    throw new PaymentError('Não conseguimos abrir o pagamento agora. Tente novamente em alguns instantes.')
  }
}

async function giftCountsTx(tx: Tx, giftId: string) {
  return (await giftCounts([giftId], tx)).get(giftId)
}

/**
 * Aplica o estado de um pagamento consultado NA API do Mercado Pago (nunca no corpo do webhook).
 * Idempotente: cada combinação (pagamento, status, detalhe, atualização) é processada uma única vez.
 */
export async function applyMpPayment(mp: MpPayment, source: 'webhook' | 'return' | 'sync' | 'simulation') {
  const ref = mp.external_reference
  if (!ref || !/^[0-9a-f-]{36}$/i.test(ref)) return { handled: false, reason: 'external_reference ausente' }
  const mpId = String(mp.id)
  const incoming = mapMpStatus(mp.status, mp.status_detail)
  const dedupeKey = `mp:${mpId}:${mp.status}:${mp.status_detail ?? ''}:${mp.date_last_updated ?? ''}`

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.paymentEvents)
      .values({
        paymentId: ref,
        source,
        dedupeKey,
        mpPaymentId: mpId,
        mpStatus: mp.status,
        mpStatusDetail: mp.status_detail ?? null,
        data: {
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

    const [payment] = await tx.select().from(schema.giftPayments).where(eq(schema.giftPayments.id, ref)).for('update')
    if (!payment) return { handled: false, reason: 'pagamento desconhecido' }

    const expected = payment.amountCents / 100
    if (mp.currency_id !== 'BRL' || Math.abs(mp.transaction_amount - expected) > 0.009) {
      await tx
        .update(schema.giftPayments)
        .set({ statusDetail: `amount_mismatch:${mp.transaction_amount}`, updatedAt: new Date() })
        .where(eq(schema.giftPayments.id, payment.id))
      console.error(`Valor divergente no pagamento ${payment.id}: esperado ${expected}, recebido ${mp.transaction_amount}`)
      return { handled: false, reason: 'valor divergente' }
    }

    const target = nextStatus(payment, { status: incoming, mpPaymentId: mpId })
    if (!target) return { handled: true, status: payment.status }

    const now = new Date()
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
    return { handled: true, status: target }
  })
}

/** Processa uma notificação (webhook): busca o pagamento na API e aplica. */
export async function processMpNotification(mpPaymentId: string) {
  const token = env.mpAccessToken
  if (!token) throw new MercadoPagoError('MP_ACCESS_TOKEN não configurado')
  const mp = await getPayment(token, mpPaymentId)
  return applyMpPayment(mp, 'webhook')
}

/** Consulta ativa (página de retorno / admin): procura pagamentos pela referência externa. */
export async function syncPaymentWithMp(paymentId: string, source: 'return' | 'sync' = 'sync') {
  const token = env.mpAccessToken
  if (!token) return
  try {
    const results = await searchPaymentsByReference(token, paymentId)
    // Mais antigos primeiro, para o estado final refletir o mais recente.
    for (const mp of results.reverse()) await applyMpPayment(mp, source)
  } catch (err) {
    console.error('Falha ao sincronizar pagamento', paymentId, err)
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
export async function simulatePayment(paymentId: string, outcome: 'approved' | 'rejected' | 'pending') {
  if (!env.paymentsSimulation) throw new PaymentError('Simulação desativada.')
  const [payment] = await db.select().from(schema.giftPayments).where(eq(schema.giftPayments.id, paymentId))
  if (!payment || payment.provider !== 'simulation') throw new PaymentError('Pagamento não encontrado.')
  const now = new Date().toISOString()
  return applyMpPayment(
    {
      id: Number(`9${Date.now()}`.slice(0, 15)),
      status: outcome,
      status_detail: outcome === 'approved' ? 'accredited' : outcome === 'rejected' ? 'cc_rejected_other_reason' : 'pending_waiting_transfer',
      external_reference: payment.id,
      transaction_amount: payment.amountCents / 100,
      currency_id: 'BRL',
      payment_method_id: 'pix',
      payment_type_id: 'bank_transfer',
      date_approved: outcome === 'approved' ? now : null,
      date_last_updated: now,
    },
    'simulation',
  )
}

export async function getPaymentById(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [row] = await db.select().from(schema.giftPayments).where(eq(schema.giftPayments.id, id))
  return row ?? null
}

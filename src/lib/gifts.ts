import 'server-only'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, schema, type Tx } from '@/lib/db'
import { formatBRL } from '@/lib/format'

export type Gift = typeof schema.gifts.$inferSelect
export type GiftCategory = typeof schema.giftCategories.$inferSelect

/** Reserva temporária: quem iniciou um presente tem 30 min para concluir. */
export const RESERVATION_MINUTES = 30

export type GiftAvailabilityInfo = { available: boolean; remaining: number | null; given: number }

/** Quantos presentes já foram dados (aprovados) e quantos estão reservados, por presente. */
export async function giftCounts(giftIds?: string[], executor: Tx | typeof db = db) {
  const rows = await executor
    .select({
      giftId: schema.giftPayments.giftId,
      approved: sql<number>`count(*) filter (where ${schema.giftPayments.status} = 'approved')`,
      reserved: sql<number>`count(*) filter (where ${schema.giftPayments.status} = 'awaiting'
        and (${schema.giftPayments.expiresAt} is null or ${schema.giftPayments.expiresAt} > now())
        and (${schema.giftPayments.mpPaymentId} is not null
             or ${schema.giftPayments.createdAt} > now() - make_interval(mins => ${RESERVATION_MINUTES})))`,
    })
    .from(schema.giftPayments)
    .where(giftIds?.length ? inArray(schema.giftPayments.giftId, giftIds) : undefined)
    .groupBy(schema.giftPayments.giftId)
  return new Map(rows.map((r) => [r.giftId, { approved: Number(r.approved), reserved: Number(r.reserved) }]))
}

export function availabilityOf(gift: Pick<Gift, 'availability' | 'quantity'>, counts?: { approved: number; reserved: number }): GiftAvailabilityInfo {
  const approved = counts?.approved ?? 0
  const reserved = counts?.reserved ?? 0
  if (gift.availability === 'unlimited') return { available: true, remaining: null, given: approved }
  const total = gift.availability === 'unique' ? 1 : Math.max(0, gift.quantity ?? 0)
  const remaining = Math.max(0, total - approved - reserved)
  return { available: remaining > 0, remaining, given: approved }
}

export async function listPublicGifts() {
  const [categories, gifts] = await Promise.all([
    db
      .select()
      .from(schema.giftCategories)
      .where(eq(schema.giftCategories.isActive, true))
      .orderBy(asc(schema.giftCategories.sortOrder), asc(schema.giftCategories.name)),
    db
      .select()
      .from(schema.gifts)
      .where(and(eq(schema.gifts.isActive, true), isNull(schema.gifts.archivedAt)))
      .orderBy(asc(schema.gifts.sortOrder), asc(schema.gifts.name)),
  ])
  const counts = await giftCounts(gifts.map((g) => g.id))
  const withAvail = gifts.map((g) => ({ ...g, avail: availabilityOf(g, counts.get(g.id)) }))
  const grouped = categories
    .map((c) => ({ category: c, gifts: withAvail.filter((g) => g.categoryId === c.id) }))
    .filter((c) => c.gifts.length)
  const orphan = withAvail.filter((g) => !g.categoryId || !categories.some((c) => c.id === g.categoryId))
  if (orphan.length) {
    grouped.push({
      category: { id: 'outros', name: 'Outras ideias', slug: 'outros', description: null, icon: null, sortOrder: 999, isActive: true, createdAt: new Date() },
      gifts: orphan,
    })
  }
  return grouped
}

export async function getPublicGift(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [gift] = await db
    .select()
    .from(schema.gifts)
    .where(and(eq(schema.gifts.id, id), eq(schema.gifts.isActive, true), isNull(schema.gifts.archivedAt)))
  if (!gift) return null
  const counts = await giftCounts([gift.id])
  return { ...gift, avail: availabilityOf(gift, counts.get(gift.id)) }
}

/** Valida o valor informado. Retorna mensagem de erro (ou null) e o valor final em centavos. */
export function resolveGiftAmount(
  gift: Pick<Gift, 'priceType' | 'amountCents' | 'minCents' | 'maxCents'>,
  requestedCents: number | null,
): { cents: number; error: null } | { cents: null; error: string } {
  if (gift.priceType === 'fixed') {
    if (!gift.amountCents || gift.amountCents < 100) return { cents: null, error: 'Este presente está sem valor definido.' }
    return { cents: gift.amountCents, error: null }
  }
  if (requestedCents === null || !Number.isFinite(requestedCents)) {
    return { cents: null, error: 'Conte para nós quanto você gostaria de presentear.' }
  }
  const min = Math.max(100, gift.minCents ?? 100)
  if (requestedCents < min) return { cents: null, error: `O valor mínimo para este presente é ${formatBRL(min)}.` }
  if (gift.maxCents && requestedCents > gift.maxCents) {
    return { cents: null, error: `O valor máximo para este presente é ${formatBRL(gift.maxCents)}.` }
  }
  if (requestedCents > 5_000_000) return { cents: null, error: 'Para valores acima de R$ 50.000, fale diretamente com os noivos.' }
  return { cents: requestedCents, error: null }
}
